/* ============================================================
   MediConnect · pruebas/logica.test.js
   Pruebas de la logica que sostiene el prototipo.

   Correr con:   node --test pruebas/
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepararEntorno, limpiarDatos } from './entorno.js';

// El entorno se prepara ANTES de importar los modulos de la app,
// porque algunos leen `location` al cargarse.
prepararEntorno('');

const fechas = await import('../js/nucleo/fechas.js');
const almacen = await import('../js/nucleo/almacen.js');
const cuenta = await import('../js/nucleo/cuenta.js');
const agenda = await import('../js/nucleo/agenda.js');
const calendario = await import('../js/nucleo/calendario.js');
const qr = await import('../js/nucleo/qr.js');
const { HORARIOS, medico } = await import('../js/nucleo/datos.js');

/* Busca un hueco libre de verdad para un medico, saltando los ocupados */
function huecoLibre(medicoId, desdeFecha){
  let f = desdeFecha || fechas.sumarDias(fechas.hoy(), 3);
  for (let i = 0; i < 30; i++){
    if (!fechas.esFinDeSemana(f)){
      const libres = agenda.horariosLibres(medicoId, f, null);
      if (libres.length) return { fecha: f, hora: libres[0].hora };
    }
    f = fechas.sumarDias(f, 1);
  }
  throw new Error('no se encontró ningún hueco libre');
}

/* ============================================================
   1 · Fechas y zona horaria
   ============================================================ */
test('fechas · la hora de pared y el instante universal son coherentes', () => {
  const i = fechas.aInstante('2026-11-25', '09:00');
  // El Salvador es UTC-6 todo el año: las 9:00 locales son las 15:00 UTC
  assert.equal(i.toISOString(), '2026-11-25T15:00:00.000Z');
  const vuelta = fechas.aPared(i);
  assert.deepEqual(vuelta, { fecha: '2026-11-25', hora: '09:00' });
});

test('fechas · el sello para el calendario va en UTC', () => {
  assert.equal(fechas.selloIcs(fechas.aInstante('2026-11-25', '09:00')), '20261125T150000Z');
});

test('fechas · las 12 del día y de la noche no se confunden', () => {
  assert.equal(fechas.hora12('00:00'), '12:00 a. m.');
  assert.equal(fechas.hora12('12:00'), '12:00 p. m.');
  assert.equal(fechas.hora12('13:05'), '1:05 p. m.');
  assert.equal(fechas.hora12('09:00'), '9:00 a. m.');
});

test('fechas · los días hábiles saltan sábados y domingos', () => {
  // 2026-11-21 es sábado
  const dias = fechas.diasHabiles('2026-11-21', 5);
  assert.deepEqual(dias, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
  assert.ok(dias.every(d => !fechas.esFinDeSemana(d)));
});

test('fechas · sumar días cruza bien el cambio de mes y de año', () => {
  assert.equal(fechas.sumarDias('2026-11-30', 1), '2026-12-01');
  assert.equal(fechas.sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(fechas.sumarDias('2028-02-28', 1), '2028-02-29');   // año bisiesto
  assert.equal(fechas.diferenciaDias('2026-11-23', '2026-12-01'), 8);
});

/* ============================================================
   2 · Cuenta
   ============================================================ */
test('cuenta · registro, sesión y contraseña', async (t) => {
  limpiarDatos();

  await t.test('rechaza datos incompletos', async () => {
    const r = await cuenta.registrar({ nombre: 'A', correo: 'noesuncorreo', clave: '123' });
    assert.equal(r.ok, false);
    assert.ok(r.error);
  });

  await t.test('crea la cuenta y abre la sesión', async () => {
    const r = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'Karol@Ejemplo.COM', clave: 'medi2026demo' });
    assert.equal(r.ok, true);
    assert.equal(r.usuario.correo, 'karol@ejemplo.com');       // se normaliza a minúsculas
    assert.ok(cuenta.usuarioActual());
  });

  await t.test('no guarda la contraseña en claro', () => {
    const u = cuenta.usuarioActual();
    const crudo = JSON.stringify(almacen.leer());
    assert.ok(!crudo.includes('medi2026demo'), 'la contraseña aparece en el almacenamiento');
    assert.ok(u.hash.startsWith('pbkdf2:'));
    assert.ok(u.sal && u.sal.length >= 16);
  });

  await t.test('dos cuentas con la misma contraseña tienen huellas distintas', async () => {
    const otra = await cuenta.registrar({ nombre: 'Kiyomi Alfaro', correo: 'kiyomi@ejemplo.com', clave: 'medi2026demo' });
    assert.equal(otra.ok, true);
    const [a, b] = almacen.leer().usuarios;
    assert.notEqual(a.hash, b.hash);
  });

  await t.test('no deja repetir el correo', async () => {
    const r = await cuenta.registrar({ nombre: 'Otra Persona', correo: 'karol@ejemplo.com', clave: 'otraclave99' });
    assert.equal(r.ok, false);
  });

  await t.test('la contraseña incorrecta no entra', async () => {
    cuenta.cerrarSesion();
    const mal = await cuenta.iniciarSesion({ correo: 'karol@ejemplo.com', clave: 'equivocada1' });
    assert.equal(mal.ok, false);
    assert.equal(cuenta.usuarioActual(), null);
    const bien = await cuenta.iniciarSesion({ correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
    assert.equal(bien.ok, true);
  });

  await t.test('el mensaje de error no revela si el correo existe', async () => {
    const a = await cuenta.iniciarSesion({ correo: 'karol@ejemplo.com', clave: 'equivocada1' });
    const b = await cuenta.iniciarSesion({ correo: 'nadie@ejemplo.com', clave: 'equivocada1' });
    assert.equal(a.error, b.error);
  });
});

/* ============================================================
   3 · Agenda: el corazón del proyecto
   ============================================================ */
test('agenda · reservar, chocar, repetir y liberar', async (t) => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = false;
  const alta = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
  const yo = alta.usuario.id;
  const hueco = huecoLibre('her');

  let reserva;

  await t.test('una reserva válida se guarda', () => {
    reserva = agenda.reservar({ medicoId: 'her', ...hueco, usuarioId: yo, claveIdem: 'k1' });
    assert.equal(reserva.ok, true);
    assert.equal(reserva.cita.estado, 'agendada');
    assert.match(reserva.cita.codigo, /^MC-[A-Z0-9]{6}$/);
  });

  await t.test('el mismo horario no se puede reservar dos veces', () => {
    const otra = agenda.reservar({ medicoId: 'her', ...hueco, usuarioId: yo, claveIdem: 'k2' });
    assert.equal(otra.ok, false);
    assert.equal(otra.codigo, 'horario-ocupado');
  });

  await t.test('el doble clic no crea dos citas (idempotencia)', () => {
    const repetida = agenda.reservar({ medicoId: 'her', ...hueco, usuarioId: yo, claveIdem: 'k1' });
    assert.equal(repetida.ok, true);
    assert.equal(repetida.repetida, true);
    assert.equal(repetida.cita.id, reserva.cita.id);
    assert.equal(almacen.leer().citas.length, 1);
  });

  await t.test('ese horario ya no aparece como libre', () => {
    const libres = agenda.horariosLibres('her', hueco.fecha, yo).map(h => h.hora);
    assert.ok(!libres.includes(hueco.hora));
  });

  await t.test('otro médico sí puede atender a esa misma hora', () => {
    const doc = medico('tak');
    if (!doc.agenda.includes(hueco.hora)) return;                 // ese médico no atiende a esa hora
    const estados = agenda.horariosDe('tak', hueco.fecha, yo);
    const h = estados.find(x => x.hora === hueco.hora);
    assert.ok(h && h.estado !== 'mia');
  });

  await t.test('cancelar libera el horario', () => {
    const r = agenda.cancelar({ citaId: reserva.cita.id, usuarioId: yo });
    assert.equal(r.ok, true);
    assert.equal(r.cita.estado, 'cancelada');
    const libres = agenda.horariosLibres('her', hueco.fecha, yo).map(h => h.hora);
    assert.ok(libres.includes(hueco.hora), 'el horario debería volver a estar libre');
  });

  await t.test('cancelar dos veces no rompe nada', () => {
    const r = agenda.cancelar({ citaId: reserva.cita.id, usuarioId: yo });
    assert.equal(r.ok, true);
    assert.equal(r.repetida, true);
  });
});

test('agenda · reglas de negocio', async () => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = false;
  const alta = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
  const yo = alta.usuario.id;

  // fin de semana
  let sabado = fechas.hoy();
  while (!fechas.esFinDeSemana(sabado)) sabado = fechas.sumarDias(sabado, 1);
  const finde = agenda.reservar({ medicoId: 'her', fecha: sabado, hora: '09:00', usuarioId: yo });
  assert.equal(finde.ok, false);
  assert.equal(finde.codigo, 'fin-de-semana');

  // en el pasado
  let ayer = fechas.sumarDias(fechas.hoy(), -1);
  while (fechas.esFinDeSemana(ayer)) ayer = fechas.sumarDias(ayer, -1);
  const pasado = agenda.reservar({ medicoId: 'her', fecha: ayer, hora: '09:00', usuarioId: yo });
  assert.equal(pasado.ok, false);
  assert.equal(pasado.codigo, 'en-el-pasado');

  // horario que ese médico no atiende (el Dr. Herrera no tiene 10:30)
  const futuro = huecoLibre('her').fecha;
  assert.ok(!medico('her').agenda.includes('10:30'));
  const fuera = agenda.reservar({ medicoId: 'her', fecha: futuro, hora: '10:30', usuarioId: yo });
  assert.equal(fuera.ok, false);
  assert.equal(fuera.codigo, 'fuera-de-agenda');

  // médico inexistente
  const nadie = agenda.reservar({ medicoId: 'xxx', fecha: futuro, hora: '09:00', usuarioId: yo });
  assert.equal(nadie.ok, false);
});

test('agenda · tope de citas activas por paciente', async () => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = false;
  const alta = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
  const yo = alta.usuario.id;

  let hechas = 0, rechazo = null, fecha = fechas.sumarDias(fechas.hoy(), 3);
  for (let i = 0; i < 40 && !rechazo; i++){
    if (fechas.esFinDeSemana(fecha)){ fecha = fechas.sumarDias(fecha, 1); continue; }
    const libres = agenda.horariosLibres('her', fecha, yo);
    if (!libres.length){ fecha = fechas.sumarDias(fecha, 1); continue; }
    const r = agenda.reservar({ medicoId: 'her', fecha, hora: libres[0].hora, usuarioId: yo, claveIdem: 'tope' + i });
    if (r.ok) hechas++; else rechazo = r;
  }
  assert.equal(hechas, 3);
  assert.equal(rechazo.codigo, 'demasiadas');
});

test('agenda · cada cuenta ve solo sus citas', async () => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = false;

  const a = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
  const h1 = huecoLibre('her');
  const cita = agenda.reservar({ medicoId: 'her', ...h1, usuarioId: a.usuario.id, claveIdem: 'a1' });
  assert.equal(cita.ok, true);

  cuenta.cerrarSesion();
  const b = await cuenta.registrar({ nombre: 'Caleb Galán', correo: 'caleb@ejemplo.com', clave: 'medi2026demo' });

  assert.equal(agenda.citasDe(b.usuario.id).length, 0);
  assert.equal(agenda.citasDe(a.usuario.id).length, 1);

  // Ni verla por código, ni cancelarla, ni moverla
  assert.equal(agenda.citaPorCodigo(cita.cita.codigo, b.usuario.id).ajena, true);
  assert.equal(agenda.cancelar({ citaId: cita.cita.id, usuarioId: b.usuario.id }).codigo, 'ajena');
  assert.equal(agenda.reprogramar({ citaId: cita.cita.id, fecha: h1.fecha, hora: h1.hora, usuarioId: b.usuario.id }).codigo, 'ajena');
  assert.equal(agenda.checkIn({ codigo: cita.cita.codigo, usuarioId: b.usuario.id }).codigo, 'ajena');

  // Y como invitado tampoco
  cuenta.cerrarSesion();
  assert.equal(agenda.citasDe(null).length, 0);
});

test('agenda · reprogramar mueve la cita y libera el horario anterior', async () => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = false;
  const alta = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
  const yo = alta.usuario.id;

  const antes = huecoLibre('her');
  const r = agenda.reservar({ medicoId: 'her', ...antes, usuarioId: yo, claveIdem: 'r1' });
  const despues = huecoLibre('her', fechas.sumarDias(antes.fecha, 1));

  const mov = agenda.reprogramar({ citaId: r.cita.id, fecha: despues.fecha, hora: despues.hora, usuarioId: yo });
  assert.equal(mov.ok, true);
  assert.equal(mov.cita.fecha, despues.fecha);
  assert.equal(mov.cita.cambios, 1);
  assert.deepEqual(mov.antes, antes);

  assert.ok(agenda.horariosLibres('her', antes.fecha, yo).some(h => h.hora === antes.hora));
  assert.ok(!agenda.horariosLibres('her', despues.fecha, yo).some(h => h.hora === despues.hora));

  // No se puede mover encima de un horario ocupado
  const otraFecha = huecoLibre('her', fechas.sumarDias(despues.fecha, 1));
  const otra = agenda.reservar({ medicoId: 'her', ...otraFecha, usuarioId: yo, claveIdem: 'r2' });
  assert.equal(otra.ok, true);
  const choque = agenda.reprogramar({ citaId: r.cita.id, fecha: otraFecha.fecha, hora: otraFecha.hora, usuarioId: yo });
  assert.equal(choque.ok, false);
  assert.equal(choque.codigo, 'horario-ocupado');
});

test('agenda · las citas de invitado pasan a la cuenta al registrarse', async () => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = false;

  const h = huecoLibre('tak');
  const comoInvitado = agenda.reservar({ medicoId: 'tak', ...h, usuarioId: null, claveIdem: 'inv' });
  assert.equal(comoInvitado.ok, true);
  assert.equal(comoInvitado.cita.invitado, true);
  assert.equal(agenda.citasDe(null).length, 1);

  const alta = await cuenta.registrar({ nombre: 'Karol Alfaro', correo: 'karol@ejemplo.com', clave: 'medi2026demo' });
  const adopcion = agenda.adoptarCitasDeInvitado(alta.usuario.id);
  assert.equal(adopcion.adoptadas, 1);
  assert.equal(agenda.citasDe(alta.usuario.id).length, 1);
  assert.equal(agenda.citasDe(null).length, 0);
});

test('agenda · el día sin cupos del panel bloquea de verdad', async () => {
  limpiarDatos();
  agenda.simulacion.diaSinCupos = true;
  const bloqueado = agenda.diaBloqueado();
  assert.ok(bloqueado);
  assert.equal(agenda.horariosLibres('her', bloqueado, null).length, 0);
  assert.equal(agenda.diaLleno('her', bloqueado, null), true);

  const r = agenda.reservar({ medicoId: 'her', fecha: bloqueado, hora: '09:00', usuarioId: null });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'dia-sin-cupos');

  const siguiente = agenda.proximoDiaLibre('her', bloqueado, null);
  assert.notEqual(siguiente, bloqueado);
  agenda.simulacion.diaSinCupos = false;
});

test('agenda · la fecha de control cae en día hábil', () => {
  for (const base of ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']){
    const f = agenda.fechaControl({ fecha: base });
    assert.ok(!fechas.esFinDeSemana(f), f + ' cayó en fin de semana');
    assert.ok(fechas.diferenciaDias(base, f) >= 7);
  }
});

/* ============================================================
   4 · Calendario (.ics)
   ============================================================ */
test('calendario · el archivo .ics es válido y muestra la hora correcta', () => {
  limpiarDatos();
  const cita = {
    codigo: 'MC-ABC123', medicoId: 'her', fecha: '2026-11-25', hora: '09:00',
    duracionMin: 30, estado: 'agendada', cambios: 0, control: false
  };
  const texto = calendario.ics(cita, { urlComprobante: 'https://ejemplo.github.io/mediconnect/comprobante.html?cita=MC-ABC123' });

  for (const clave of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:MC-ABC123@mediconnect.demo',
                       'DTSTART:20261125T150000Z', 'DTEND:20261125T153000Z', 'STATUS:CONFIRMED',
                       'BEGIN:VALARM', 'TRIGGER:-PT1H', 'END:VCALENDAR']){
    assert.ok(texto.includes(clave), 'falta ' + clave);
  }

  // Todas las líneas terminan en CRLF y ninguna pasa de 75 octetos
  const lineas = texto.split('\r\n').filter(Boolean);
  for (const l of lineas){
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75, 'línea demasiado larga: ' + l.slice(0, 40));
  }
  assert.ok(texto.endsWith('\r\n'));

  // Los puntos y comas del texto van escapados
  assert.ok(!/[^\\];/.test(texto.split('DESCRIPTION:')[1].split('\r\n')[0] || ''));

  // Una cita cancelada sale como CANCELLED
  const cancelada = calendario.ics(Object.assign({}, cita, { estado: 'cancelada' }));
  assert.ok(cancelada.includes('STATUS:CANCELLED'));
});

test('calendario · el enlace de Google lleva la misma hora', () => {
  const cita = { codigo: 'MC-ABC123', medicoId: 'her', fecha: '2026-11-25', hora: '09:00', duracionMin: 30, estado: 'agendada', cambios: 0 };
  const url = new URL(calendario.urlGoogle(cita));
  assert.equal(url.searchParams.get('dates'), '20261125T150000Z/20261125T153000Z');
  assert.equal(url.searchParams.get('ctz'), 'America/El_Salvador');
  assert.ok(url.searchParams.get('text').includes('Dr. Luis Herrera'));
});

/* ============================================================
   5 · Códigos QR
   ============================================================ */
test('qr · tamaño y versión correctos según el texto', () => {
  const corto = qr.generar('MC-7K3QB2', { nivel: 'M' });
  assert.equal(corto.version, 1);
  assert.equal(corto.lado, 21);

  const largo = qr.generar('https://ejemplo.github.io/mediconnect/comprobante.html?cita=MC-7K3QB2', { nivel: 'M' });
  assert.equal(largo.lado, largo.version * 4 + 17);
  assert.ok(largo.version >= 4);
});

test('qr · la matriz no cambia (regresión)', () => {
  // Estas huellas se tomaron de matrices verificadas dos veces:
  //   · comparadas módulo a módulo contra la librería `qrcode` (24/24 idénticas)
  //   · decodificadas con jsQR, devolviendo exactamente el mismo texto (24/24)
  // Si alguna cambia, el generador se rompió y los QR dejarían de escanearse.
  const huella = (t, n) => createHash('sha256')
    .update(qr.generar(t, { nivel: n }).matriz.map(f => f.map(c => (c ? 1 : 0)).join('')).join('\n'))
    .digest('hex').slice(0, 16);

  const casos = [
    ['MC-7K3QB2', 'M', 'b83ae400b9ba95f3'],
    ['https://ejemplo.github.io/mediconnect/', 'M', 'c8bfc75c97c18c47'],
    ['https://ejemplo.github.io/mediconnect/comprobante.html?cita=MC-7K3QB2', 'Q', 'dcbedb7a2dbfff1d']
  ];
  for (const [texto, nivel, esperada] of casos){
    assert.equal(huella(texto, nivel), esperada, 'cambió el QR de: ' + texto);
  }
});

test('qr · los tres cuadros de las esquinas están donde deben', () => {
  const { matriz, lado } = qr.generar('https://ejemplo.github.io/mediconnect/', { nivel: 'M' });
  const esCuadro = (ox, oy) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++){
        const borde = x === 0 || x === 6 || y === 0 || y === 6;
        const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (matriz[oy + y][ox + x] !== (borde || centro)) return false;
      }
    return true;
  };
  assert.ok(esCuadro(0, 0), 'falta el cuadro de arriba a la izquierda');
  assert.ok(esCuadro(lado - 7, 0), 'falta el cuadro de arriba a la derecha');
  assert.ok(esCuadro(0, lado - 7), 'falta el cuadro de abajo a la izquierda');

  // La línea de sincronía alterna
  for (let i = 8; i < lado - 8; i++) assert.equal(matriz[6][i], i % 2 === 0);

  // El módulo oscuro fijo
  assert.equal(matriz[lado - 8][8], true);
});

test('qr · el SVG sale bien formado y con zona tranquila', () => {
  const svg = qr.svg('https://ejemplo.github.io/mediconnect/', { tamano: 200 });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('width="200"'));
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const { lado } = qr.generar('https://ejemplo.github.io/mediconnect/', { nivel: 'M' });
  assert.equal(Number(vb[1]), lado + 8);     // 4 módulos de margen a cada lado
});

/* ============================================================
   6 · Almacenamiento
   ============================================================ */
test('almacén · la transacción vuelve a leer antes de escribir', () => {
  limpiarDatos();
  // Dos "pestañas" que leen a la vez y escriben: la segunda ve lo de la primera
  almacen.transaccion(d => { d.citas.push({ id: '1' }); });
  almacen.transaccion(d => { d.citas.push({ id: '2' }); });
  assert.equal(almacen.leer().citas.length, 2);
});

test('almacén · los códigos de cita no se repiten', () => {
  const vistos = new Set();
  for (let i = 0; i < 2000; i++){
    const c = almacen.nuevoCodigo();
    assert.match(c, /^MC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    vistos.add(c);
  }
  assert.ok(vistos.size > 1990, 'demasiados códigos repetidos: ' + vistos.size);
});
