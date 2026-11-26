/* ============================================================
   MediConnect · pruebas/flujos-n8n.test.js
   Prueba el codigo que vive dentro de los nodos "Code" de n8n,
   sin levantar n8n.

   Como: se lee el .json del flujo, se saca el `jsCode` de cada
   nodo y se ejecuta con un `$input` y un `$getWorkflowStaticData`
   de mentira, igual que haria n8n.

   Asi se comprueban las validaciones, la idempotencia, el armado
   del correo y el programador del recordatorio. Lo unico que no
   se puede probar aqui es el envio real por Gmail: eso necesita
   tus credenciales y se verifica a mano.

   Correr con:  node --test pruebas/flujos-n8n.test.js
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CARPETA = path.join(AQUI, '..', 'n8n');

/* ------------------------------------------------------------
   Mini imitación del entorno de n8n
   ------------------------------------------------------------ */
function cargarFlujo(archivo){
  return JSON.parse(fs.readFileSync(path.join(CARPETA, archivo), 'utf8'));
}

function nodoCode(flujo, nombre){
  const n = flujo.nodes.find(x => x.name === nombre && x.type === 'n8n-nodes-base.code');
  if (!n) throw new Error('no existe el nodo Code "' + nombre + '" en ' + flujo.name);
  return n.parameters.jsCode;
}

/** Ejecuta el código de un nodo con la entrada dada. `memoria` persiste entre llamadas. */
function ejecutar(codigo, entrada, memoria = {}){
  const items = (Array.isArray(entrada) ? entrada : [entrada]).map(j => ({ json: j }));
  const $input = {
    first: () => items[0] || { json: {} },
    all: () => items,
    last: () => items[items.length - 1] || { json: {} }
  };
  const $getWorkflowStaticData = () => memoria;
  const fn = new Function('$input', '$getWorkflowStaticData', 'Buffer', '"use strict";' + codigo);
  return { salida: fn($input, $getWorkflowStaticData, Buffer), memoria };
}

/* Un evento de reserva completo, como el que manda la app */
const eventoReserva = (extra = {}) => Object.assign({
  evento: 'reserva',
  idEvento: 'ev-' + Math.random().toString(36).slice(2),
  enviadoEn: new Date().toISOString(),
  zona: { id: 'America/El_Salvador', desfase: '-06:00' },
  app: { nombre: 'MediConnect', version: '3.0', url: 'https://ejemplo.github.io/mediconnect/' },
  paciente: { nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com' },
  cita: {
    codigo: 'MC-ABC123',
    estado: 'agendada',
    esControl: false,
    fecha: '2026-11-25',
    hora: '09:00',
    fechaTexto: 'Miércoles 25 de noviembre',
    horaTexto: '9:00 a. m.',
    inicioUtc: '2026-11-25T15:00:00.000Z',
    duracionMin: 30,
    medico: { id: 'her', nombre: 'Dr. Luis Herrera', especialidad: 'Cardiología', consultorio: 'Consultorio 8 · 3.er piso' },
    lugar: { clinica: 'Centro Médico MediConnect', direccion: 'Paseo General Escalón', telefono: '2200-1000' },
    enlaces: {
      comprobante: 'https://ejemplo.github.io/mediconnect/comprobante.html?cita=MC-ABC123',
      calendarioGoogle: 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    }
  },
  ics: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:MC-ABC123@mediconnect.demo\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
  icsNombre: 'mediconnect-mc-abc123.ics'
}, extra);

/* ============================================================
   Los cuatro archivos existen y están bien formados
   ============================================================ */
test('n8n · los cuatro flujos existen y son JSON válido', () => {
  const esperados = ['MC-01-registro.json', 'MC-02-reserva.json', 'MC-03-cambio-cancelacion.json', 'MC-04-recordatorio.json'];
  for (const a of esperados){
    const f = cargarFlujo(a);
    assert.ok(f.name, a + ' no tiene nombre');
    assert.ok(Array.isArray(f.nodes) && f.nodes.length >= 5, a + ' tiene muy pocos nodos');
    assert.ok(f.connections && Object.keys(f.connections).length, a + ' no tiene conexiones');
    // Cada nodo conectado tiene que existir
    const nombres = new Set(f.nodes.map(n => n.name));
    for (const [desde, salidas] of Object.entries(f.connections)){
      assert.ok(nombres.has(desde), a + ': conexión desde un nodo inexistente ' + desde);
      for (const rama of salidas.main) for (const c of rama)
        assert.ok(nombres.has(c.node), a + ': conexión hacia un nodo inexistente ' + c.node);
    }
  }
});

test('n8n · no hay ningún secreto en los flujos', () => {
  const sospechosos = [/client[_-]?secret/i, /api[_-]?key/i, /password\s*[:=]/i, /Bearer\s+[A-Za-z0-9]/,
                       /AIza[0-9A-Za-z_-]{20}/, /sk-[A-Za-z0-9]{20}/, /fundaciongloriakriete/i];
  const archivos = fs.readdirSync(CARPETA).filter(x => /^MC-.*\.json$/.test(x))
    .concat(fs.readdirSync(path.join(CARPETA, 'cloud')).filter(x => /^MC-.*\.json$/.test(x)).map(x => path.join('cloud', x)));
  for (const a of archivos){
    const crudo = fs.readFileSync(path.join(CARPETA, a), 'utf8');
    for (const re of sospechosos){
      assert.ok(!re.test(crudo), a + ' contiene algo que parece un secreto: ' + re);
    }
    // Las credenciales se referencian por nombre, con el id vacío
    const f = JSON.parse(crudo);
    for (const n of f.nodes){
      if (!n.credentials) continue;
      for (const c of Object.values(n.credentials)) assert.equal(c.id, '', a + ': ' + n.name + ' trae un id de credencial');
    }
  }
});

test('n8n · los webhooks responden con las rutas que usa la app', () => {
  const rutas = [];
  for (const a of fs.readdirSync(CARPETA).filter(x => /^MC-.*\.json$/.test(x))){
    for (const n of cargarFlujo(a).nodes){
      if (n.type === 'n8n-nodes-base.webhook'){
        rutas.push(n.parameters.path);
        assert.equal(n.parameters.httpMethod, 'POST');
        assert.equal(n.parameters.responseMode, 'responseNode');
        assert.ok(n.parameters.options.allowedOrigins, n.parameters.path + ' sin CORS configurado');
      }
    }
  }
  for (const esperada of ['mediconnect/registro', 'mediconnect/reserva', 'mediconnect/cambio',
                          'mediconnect/cancelacion', 'mediconnect/recordatorio']){
    assert.ok(rutas.includes(esperada), 'falta el webhook ' + esperada);
  }
});

/* ============================================================
   MC-01 · Registro
   ============================================================ */
test('MC-01 · registro', async (t) => {
  const codigo = nodoCode(cargarFlujo('MC-01-registro.json'), 'Validar y preparar');
  const memoria = {};

  await t.test('la prueba de conexión responde sin mandar correo', () => {
    const { salida } = ejecutar(codigo, { evento: 'prueba', prueba: true, idEvento: 'p1' }, memoria);
    assert.equal(salida[0].json.enviar, false);
    assert.equal(salida[0].json.respuesta.ok, true);
  });

  await t.test('rechaza un correo inválido', () => {
    const { salida } = ejecutar(codigo, {
      evento: 'registro', idEvento: 'r0', paciente: { nombre: 'X', correo: 'no-es-correo' }
    }, memoria);
    assert.equal(salida[0].json.enviar, false);
    assert.equal(salida[0].json.respuesta.ok, false);
    assert.match(salida[0].json.errores.join(' '), /correo/);
  });

  await t.test('arma la bienvenida', () => {
    const { salida } = ejecutar(codigo, {
      evento: 'registro', idEvento: 'r1',
      paciente: { nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com' },
      app: { url: 'https://ejemplo.github.io/mediconnect/' },
      zona: { id: 'America/El_Salvador' }
    }, memoria);
    const j = salida[0].json;
    assert.equal(j.enviar, true);
    assert.equal(j.para, 'karol@ejemplo.com');
    assert.match(j.asunto, /cuenta/i);
    assert.match(j.html, /¡Hola, Karol!/);
    assert.match(j.html, /<!doctype html>/i);
    assert.match(j.html, /#3B5BF6/);
    assert.ok(!j.html.includes('<script'), 'el correo no debe llevar scripts');
  });

  await t.test('el mismo evento dos veces no manda dos correos', () => {
    const { salida } = ejecutar(codigo, {
      evento: 'registro', idEvento: 'r1',
      paciente: { nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com' }
    }, memoria);
    assert.equal(salida[0].json.enviar, false);
    assert.equal(salida[0].json.motivo, 'duplicado');
    assert.equal(salida[0].json.respuesta.duplicado, true);
  });

  await t.test('escapa el HTML que venga en el nombre', () => {
    const { salida } = ejecutar(codigo, {
      evento: 'registro', idEvento: 'r2',
      paciente: { nombre: '<script>alert(1)</script> Ana', correo: 'ana@ejemplo.com' }
    }, memoria);
    assert.ok(!salida[0].json.html.includes('<script>'));
    assert.ok(salida[0].json.html.includes('&lt;script&gt;'));
  });
});

/* ============================================================
   MC-02 · Reserva
   ============================================================ */
test('MC-02 · reserva', async (t) => {
  const codigo = nodoCode(cargarFlujo('MC-02-reserva.json'), 'Validar y preparar');
  const memoria = {};

  await t.test('arma la confirmación con todos los datos', () => {
    const { salida } = ejecutar(codigo, eventoReserva({ idEvento: 'c1' }), memoria);
    const j = salida[0].json;
    assert.equal(j.enviar, true);
    assert.equal(j.para, 'karol@ejemplo.com');
    for (const texto of ['Dr. Luis Herrera', 'Miércoles 25 de noviembre', '9:00 a. m.',
                         'Centro Médico MediConnect', 'Consultorio 8', 'MC-ABC123',
                         'America/El_Salvador', 'comprobante.html?cita=MC-ABC123']){
      assert.ok(j.html.includes(texto.replace(/&/g, '&amp;')), 'falta en el correo: ' + texto);
    }
    assert.match(j.asunto, /Cita confirmada/);
  });

  await t.test('adjunta el archivo de calendario', () => {
    const { salida } = ejecutar(codigo, eventoReserva({ idEvento: 'c2' }), memoria);
    const b = salida[0].binary;
    assert.ok(b && b.ics, 'no se generó el adjunto');
    assert.equal(b.ics.mimeType, 'text/calendar');
    assert.equal(b.ics.fileName, 'mediconnect-mc-abc123.ics');
    assert.match(Buffer.from(b.ics.data, 'base64').toString('utf8'), /BEGIN:VCALENDAR/);
  });

  await t.test('no manda confirmación de una cita cancelada', () => {
    const e = eventoReserva({ idEvento: 'c3' });
    e.cita.estado = 'cancelada';
    const { salida } = ejecutar(codigo, e, memoria);
    assert.equal(salida[0].json.enviar, false);
    assert.match(salida[0].json.errores.join(' '), /no está agendada/);
  });

  await t.test('rechaza una cita sin fecha', () => {
    const e = eventoReserva({ idEvento: 'c4' });
    delete e.cita.fecha;
    const { salida } = ejecutar(codigo, e, memoria);
    assert.equal(salida[0].json.enviar, false);
    assert.match(salida[0].json.errores.join(' '), /fecha/);
  });

  await t.test('el control se nombra como control', () => {
    const e = eventoReserva({ idEvento: 'c5' });
    e.cita.esControl = true;
    const { salida } = ejecutar(codigo, e, memoria);
    assert.match(salida[0].json.asunto, /Control agendado/);
    assert.match(salida[0].json.html, /control está agendado/i);
  });

  await t.test('el reintento con la misma clave no duplica', () => {
    const e = eventoReserva({ idEvento: 'c6' });
    ejecutar(codigo, e, memoria);
    const { salida } = ejecutar(codigo, e, memoria);
    assert.equal(salida[0].json.motivo, 'duplicado');
  });
});

/* ============================================================
   MC-03 · Cambio y cancelación
   ============================================================ */
test('MC-03 · cambio y cancelación', async (t) => {
  const codigo = nodoCode(cargarFlujo('MC-03-cambio-cancelacion.json'), 'Validar y preparar');
  const memoria = {};

  await t.test('el cambio muestra el antes y el después', () => {
    const e = eventoReserva({ idEvento: 'm1', evento: 'cambio' });
    e.anterior = { fecha: '2026-11-24', hora: '11:00', fechaTexto: 'Martes 24 de noviembre', horaTexto: '11:00 a. m.' };
    const { salida } = ejecutar(codigo, e, memoria);
    const j = salida[0].json;
    assert.equal(j.enviar, true);
    assert.ok(j.html.includes('Martes 24 de noviembre'), 'falta la fecha anterior');
    assert.ok(j.html.includes('Miércoles 25 de noviembre'), 'falta la fecha nueva');
    assert.ok(j.html.includes('MC-ABC123'), 'el código debe seguir siendo el mismo');
    assert.ok(salida[0].binary && salida[0].binary.ics, 'el cambio debe llevar el .ics nuevo');
  });

  await t.test('la cancelación avisa que el código ya no sirve', () => {
    const e = eventoReserva({ idEvento: 'm2', evento: 'cancelacion' });
    e.cita.estado = 'cancelada';
    e.razon = 'El paciente la canceló desde la app';
    const { salida } = ejecutar(codigo, e, memoria);
    const j = salida[0].json;
    assert.equal(j.enviar, true);
    assert.match(j.asunto, /cancelada/i);
    assert.match(j.html, /ya no sirve para hacer check-in/);
    assert.ok(!salida[0].binary, 'una cancelación no lleva archivo de calendario');
  });

  await t.test('no deja avisar un cambio de una cita cancelada', () => {
    const e = eventoReserva({ idEvento: 'm3', evento: 'cambio' });
    e.cita.estado = 'cancelada';
    const { salida } = ejecutar(codigo, e, memoria);
    assert.equal(salida[0].json.enviar, false);
  });

  await t.test('no deja avisar una cancelación de una cita que sigue agendada', () => {
    const e = eventoReserva({ idEvento: 'm4', evento: 'cancelacion' });
    const { salida } = ejecutar(codigo, e, memoria);
    assert.equal(salida[0].json.enviar, false);
    assert.match(salida[0].json.errores.join(' '), /no figura como cancelada/);
  });
});

/* ============================================================
   MC-04 · Recordatorio
   ============================================================ */
test('MC-04 · recordatorio', async (t) => {
  const flujo = cargarFlujo('MC-04-recordatorio.json');
  const programar = nodoCode(flujo, 'Programar o descartar');
  const revisar = nodoCode(flujo, '¿A quién le toca?');
  const memoria = {};

  const evento = (extra = {}) => Object.assign(eventoReserva(), { evento: 'recordatorio', accion: 'programar', enMinutos: 2 }, extra);

  await t.test('tiene un disparador de tiempo, no solo el webhook', () => {
    assert.ok(flujo.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'));
  });

  await t.test('programa un recordatorio', () => {
    const { salida } = ejecutar(programar, evento(), memoria);
    assert.equal(salida[0].json.respuesta.ok, true);
    assert.equal(memoria.pendientes['MC-ABC123'].enviado, false);
  });

  await t.test('todavía no toca enviarlo', () => {
    const { salida } = ejecutar(revisar, {}, memoria);
    assert.equal(salida.length, 0);
  });

  await t.test('cuando llega la hora, sale el correo', () => {
    memoria.pendientes['MC-ABC123'].cuando = Date.now() - 1000;
    const { salida } = ejecutar(revisar, {}, memoria);
    assert.equal(salida.length, 1);
    assert.equal(salida[0].json.para, 'karol@ejemplo.com');
    assert.match(salida[0].json.asunto, /Recordatorio/);
    assert.match(salida[0].json.html, /Miércoles 25 de noviembre/);
  });

  await t.test('y no se repite nunca', () => {
    const { salida } = ejecutar(revisar, {}, memoria);
    assert.equal(salida.length, 0, 'el recordatorio se mandó dos veces');
  });

  await t.test('reprogramar reemplaza, no acumula', () => {
    ejecutar(programar, evento({ idEvento: 'x1' }), memoria);
    ejecutar(programar, evento({ idEvento: 'x2', enMinutos: 30 }), memoria);
    assert.equal(Object.keys(memoria.pendientes).length, 1);
  });

  await t.test('cancelar la cita borra el recordatorio', () => {
    const { salida } = ejecutar(programar, { accion: 'cancelar', cita: { codigo: 'MC-ABC123' } }, memoria);
    assert.equal(salida[0].json.respuesta.ok, true);
    assert.equal(memoria.pendientes['MC-ABC123'], undefined);
  });

  await t.test('una cita cancelada nunca se recuerda', () => {
    ejecutar(programar, evento({ idEvento: 'y1' }), memoria);
    memoria.pendientes['MC-ABC123'].cuando = Date.now() - 1000;
    memoria.pendientes['MC-ABC123'].cita.estado = 'cancelada';
    const { salida } = ejecutar(revisar, {}, memoria);
    assert.equal(salida.length, 0);
    assert.equal(memoria.pendientes['MC-ABC123'], undefined);
  });

  await t.test('rechaza tiempos absurdos', () => {
    const { salida } = ejecutar(programar, evento({ idEvento: 'z1', enMinutos: -5 }), memoria);
    assert.equal(salida[0].json.respuesta.ok, false);
  });

  await t.test('sin correo válido no guarda nada que enviar', () => {
    const e = evento({ idEvento: 'z2' });
    e.paciente.correo = null;
    ejecutar(programar, e, memoria);
    memoria.pendientes['MC-ABC123'].cuando = Date.now() - 1000;
    const { salida } = ejecutar(revisar, {}, memoria);
    assert.equal(salida.length, 0);
  });
});

/* ============================================================
   Registro del resultado del envío
   ============================================================ */
test('n8n · el registro distingue enviado de fallido', () => {
  const codigo = nodoCode(cargarFlujo('MC-01-registro.json'), 'Registrar resultado');
  const memoria = {};

  const bien = ejecutar(codigo, { evento: 'registro', idEvento: 'a', para: 'x@y.com' }, memoria);
  assert.equal(bien.salida[0].json.respuesta.ok, true);
  assert.equal(memoria.bitacora[0].resultado, 'enviado');

  const mal = ejecutar(codigo, { evento: 'registro', idEvento: 'b', para: 'x@y.com',
                                 error: { message: 'Credenciales de Gmail no configuradas' } }, memoria);
  assert.equal(mal.salida[0].json.respuesta.ok, false);
  assert.match(mal.salida[0].json.respuesta.detalle, /Gmail/);
  assert.equal(memoria.bitacora[1].resultado, 'error');
});

/* ============================================================
   El Webhook de n8n entrega el JSON dentro de .body
   ============================================================ */
test('n8n · los flujos leen el evento aunque venga dentro de .body', () => {
  const codigo = nodoCode(cargarFlujo('MC-02-reserva.json'), 'Validar y preparar');
  const envuelto = { headers: { host: 'x.app.n8n.cloud' }, params: {}, query: {}, body: eventoReserva() };
  const { salida } = ejecutar(codigo, envuelto, {});
  assert.equal(salida[0].json.enviar, true, 'con .body no se arma el correo');
});

/* ============================================================
   MC-04 · versión n8n Cloud (sin disparador de cada minuto)
   ============================================================ */
test('MC-04 cloud · recordatorio que duerme y pregunta', async (t) => {
  const flujo = cargarFlujo(path.join('cloud', 'MC-04-recordatorio-cloud.json'));
  const programar = nodoCode(flujo, 'Programar o descartar');
  const vigente = nodoCode(flujo, 'Revisar y marcar');
  const memoria = {};
  const envolver = (body) => ({ headers: { host: 'mediconnect-karol.app.n8n.cloud' }, params: {}, query: {}, body });
  const evento = (extra = {}) => Object.assign(eventoReserva(), { evento: 'recordatorio', accion: 'programar', enMinutos: 1 }, extra);

  await t.test('no gasta ejecuciones: sin disparador de tiempo', () => {
    assert.ok(!flujo.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'));
    assert.ok(flujo.nodes.some(n => n.type === 'n8n-nodes-base.wait'));
  });

  await t.test('tiene las dos rutas', () => {
    const rutas = flujo.nodes.filter(n => n.type === 'n8n-nodes-base.webhook').map(n => n.parameters.path);
    assert.deepEqual(rutas.sort(), ['mediconnect/recordatorio', 'mediconnect/recordatorio-esperar', 'mediconnect/recordatorio-vigente']);
    // n8n solo guarda la memoria al terminar: el que programa no puede ser el que duerme
    const conexiones = flujo.connections;
    const alcanzables = new Set(); const pila = ['Recibe el recordatorio'];
    while (pila.length){ const x = pila.pop(); if (alcanzables.has(x)) continue; alcanzables.add(x);
      for (const rama of ((conexiones[x] || {}).main || [])) for (const c of rama) pila.push(c.node); }
    assert.ok(!alcanzables.has('Dormir hasta la hora'), 'la ejecución que guarda la memoria no debe quedarse dormida');
  });

  let primero;
  await t.test('programa y dice a dónde preguntar', () => {
    const { salida } = ejecutar(programar, envolver(evento()), memoria);
    primero = salida[0].json;
    assert.equal(primero.esperar, true);
    assert.equal(primero.respuesta.ok, true);
    assert.equal(primero.consulta, 'https://mediconnect-karol.app.n8n.cloud/webhook/mediconnect/recordatorio-vigente');
    assert.equal(primero.espera, 'https://mediconnect-karol.app.n8n.cloud/webhook/mediconnect/recordatorio-esperar');
    assert.ok(!Number.isNaN(Date.parse(primero.cuandoIso)));
  });

  await t.test('antes de la hora no se envía', () => {
    const { salida } = ejecutar(vigente, envolver({ codigo: primero.codigo, ficha: primero.ficha }), memoria);
    assert.equal(salida[0].json.respuesta.enviar, false);
  });

  await t.test('a la hora, se envía con el correo armado', () => {
    memoria.pendientes['MC-ABC123'].cuando = Date.now() - 1000;
    const { salida } = ejecutar(vigente, envolver({ codigo: primero.codigo, ficha: primero.ficha }), memoria);
    const r = salida[0].json.respuesta;
    assert.equal(r.enviar, true);
    assert.equal(r.para, 'karol@ejemplo.com');
    assert.match(r.html, /Miércoles 25 de noviembre/);
  });

  await t.test('y nunca dos veces', () => {
    const { salida } = ejecutar(vigente, envolver({ codigo: primero.codigo, ficha: primero.ficha }), memoria);
    assert.equal(salida[0].json.respuesta.enviar, false);
  });

  await t.test('si se reprogramó mientras dormía, el viejo no sale', () => {
    const viejo = ejecutar(programar, envolver(evento({ idEvento: 'r1' })), memoria).salida[0].json;
    const nuevo = ejecutar(programar, envolver(evento({ idEvento: 'r2', enMinutos: 30 })), memoria).salida[0].json;
    memoria.pendientes['MC-ABC123'].cuando = Date.now() - 1000;
    assert.equal(ejecutar(vigente, envolver({ codigo: viejo.codigo, ficha: viejo.ficha }), memoria).salida[0].json.respuesta.enviar, false);
    assert.equal(ejecutar(vigente, envolver({ codigo: nuevo.codigo, ficha: nuevo.ficha }), memoria).salida[0].json.respuesta.enviar, true);
  });

  await t.test('si se canceló mientras dormía, no sale', () => {
    const p = ejecutar(programar, envolver(evento({ idEvento: 'c1' })), memoria).salida[0].json;
    const cancelar = ejecutar(programar, envolver({ accion: 'cancelar', cita: { codigo: 'MC-ABC123' } }), memoria).salida[0].json;
    assert.equal(cancelar.esperar, false);
    assert.equal(ejecutar(vigente, envolver({ codigo: p.codigo, ficha: p.ficha }), memoria).salida[0].json.respuesta.enviar, false);
  });

  await t.test('rechaza tiempos absurdos y correos inválidos sin dormir', () => {
    assert.equal(ejecutar(programar, envolver(evento({ enMinutos: -5 })), memoria).salida[0].json.esperar, false);
    const e = evento(); e.paciente.correo = 'no-es-correo';
    assert.equal(ejecutar(programar, envolver(e), memoria).salida[0].json.esperar, false);
  });
});
