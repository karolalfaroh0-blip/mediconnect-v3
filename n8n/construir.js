/* ============================================================
   MediConnect · n8n/construir.js
   Genera los archivos .json que se importan en n8n.

   Se hace con un script y no a mano para que el codigo de los
   nodos "Code" se pueda leer y corregir con comodidad, sin pelear
   con las comillas dentro del JSON.

   Uso:  node n8n/construir.js
   ============================================================ */

const fs = require('node:fs');
const path = require('node:path');

const SALIDA = __dirname;
const MARCA = '#3B5BF6';

/* ------------------------------------------------------------
   Fabricas de nodos
   ------------------------------------------------------------ */
let contador = 0;
const id = (n) => 'mc-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + (++contador);

const nodo = (nombre, tipo, parametros, extra = {}) => Object.assign({
  parameters: parametros,
  id: id(nombre),
  name: nombre,
  type: tipo,
  typeVersion: extra.typeVersion || 1,
  position: extra.position || [0, 0]
}, extra.resto || {});

const webhook = (nombre, ruta, posicion) => nodo(nombre, 'n8n-nodes-base.webhook', {
  httpMethod: 'POST',
  path: ruta,
  responseMode: 'responseNode',
  options: {
    allowedOrigins: '*',          // en producción: poné aquí el dominio de tu GitHub Pages
    rawBody: false
  }
}, {
  typeVersion: 2,
  position: posicion,
  resto: { webhookId: id('wh-' + ruta) }
});

const code = (nombre, codigo, posicion) => nodo(nombre, 'n8n-nodes-base.code', {
  mode: 'runOnceForAllItems',
  jsCode: codigo
}, { typeVersion: 2, position: posicion });

const si = (nombre, expresion, posicion) => nodo(nombre, 'n8n-nodes-base.if', {
  conditions: { boolean: [{ value1: expresion, value2: true }] }
}, { typeVersion: 1, position: posicion });

const responder = (nombre, posicion) => nodo(nombre, 'n8n-nodes-base.respondToWebhook', {
  respondWith: 'json',
  responseBody: '={{ JSON.stringify($json.respuesta || $json) }}',
  options: {
    responseHeaders: {
      entries: [{ name: 'Access-Control-Allow-Origin', value: '*' }]
    }
  }
}, { typeVersion: 1, position: posicion });

const gmail = (nombre, posicion, conAdjunto) => nodo(nombre, 'n8n-nodes-base.gmail', {
  sendTo: '={{ $json.para }}',
  subject: '={{ $json.asunto }}',
  emailType: 'html',
  message: '={{ $json.html }}',
  options: Object.assign(
    { appendAttribution: false },
    conAdjunto ? { attachmentsUi: { attachmentsBinary: [{ property: 'ics' }] } } : {}
  )
}, {
  typeVersion: 2.1,
  position: posicion,
  resto: {
    credentials: { gmailOAuth2: { id: '', name: 'Gmail personal MediConnect' } },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000
  }
});

const disparadorHorario = (nombre, posicion) => nodo(nombre, 'n8n-nodes-base.scheduleTrigger', {
  rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] }
}, { typeVersion: 1.2, position: posicion });

const noop = (nombre, posicion) => nodo(nombre, 'n8n-nodes-base.noOp', {}, { typeVersion: 1, position: posicion });

/* Nota pegada en el lienzo, para que al abrir el flujo se entienda de una */
const nota = (texto, posicion, alto = 260, ancho = 420) =>
  nodo('Nota', 'n8n-nodes-base.stickyNote', {
    content: texto, height: alto, width: ancho, color: 4
  }, { typeVersion: 1, position: posicion });

/* Conexiones: [['A', 'B'], ['IF', 'C', 0], ['IF', 'D', 1]] */
function conectar(pares){
  const c = {};
  for (const [desde, hacia, salida = 0] of pares){
    c[desde] = c[desde] || { main: [] };
    while (c[desde].main.length <= salida) c[desde].main.push([]);
    c[desde].main[salida].push({ node: hacia, type: 'main', index: 0 });
  }
  return c;
}

const flujo = (nombre, nodos, conexiones, lineasNota) => ({
  name: nombre,
  nodes: [nota('## ' + nombre + '\n\n' + lineasNota.join('\n'), [-240, -420], 260, 520)].concat(nodos),
  connections: conexiones,
  active: false,
  settings: { executionOrder: 'v1', saveManualExecutions: true, timezone: 'America/El_Salvador' },
  pinData: {},
  tags: [],
  meta: { templateCredsSetupCompleted: false },
  versionId: ''
});

/* ============================================================
   Trozos de codigo que se repiten dentro de los nodos Code
   ============================================================ */

const BIBLIOTECA = `
/* ---------- utilidades compartidas ---------- */
const escapar = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const esCorreo = (c) => typeof c === 'string' && /^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$/.test(c);

/** Evita mandar dos veces el mismo aviso (doble clic, reintento de red). */
function yaProcesado(idEvento, horas = 24){
  if (!idEvento) return false;
  const guardado = $getWorkflowStaticData('global');
  guardado.vistos = guardado.vistos || {};
  const limite = Date.now() - horas * 3600000;
  for (const k of Object.keys(guardado.vistos)) if (guardado.vistos[k] < limite) delete guardado.vistos[k];
  if (guardado.vistos[idEvento]) return true;
  guardado.vistos[idEvento] = Date.now();
  return false;
}

/**
 * Plantilla del correo · estilo "liquid glass" adaptado a correo.
 * Los clientes de correo no soportan backdrop-filter, así que el vidrio se
 * imita con: fondo en degradado pastel, tarjeta blanca semitransparente con
 * filo de luz, y un bloque destacado de marca. Todo en tablas e inline,
 * con color sólido de respaldo para Outlook y Gmail.
 *   tono:      'brand' | 'ok' | 'warn' | 'danger'
 *   destacado: { etiqueta, grande, sub }  la fecha y hora en grande
 *   boton2:    botón secundario (p. ej. Google Calendar)
 */
function correoHtml({ titulo, saludo, intro, filas, aviso, boton, boton2, pie, tono, destacado }){
  const TONOS = {
    brand:  ['#3B5BF6', '#6A86FF', '#5440E6', '✓'],
    ok:     ['#157F44', '#3FB57A', '#0E6A3E', '✓'],
    warn:   ['#B66A00', '#F2A93B', '#9A5E06', '!'],
    danger: ['#B42318', '#E2574C', '#8E1C13', '×']
  };
  const [c1, c2, c3, signo] = TONOS[tono] || TONOS.brand;
  const FUENTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const fila = (etiqueta, valor, ultima) =>
    '<tr><td style="padding:12px 0;' + (ultima ? '' : 'border-bottom:1px solid #E6E9F2;') +
    'color:#6B7080;font-size:13px;width:96px;vertical-align:top">' + escapar(etiqueta) + '</td>' +
    '<td style="padding:12px 0;' + (ultima ? '' : 'border-bottom:1px solid #E6E9F2;') +
    'color:#12131A;font-size:15px;line-height:21px;font-weight:600">' + escapar(valor) + '</td></tr>';

  const btn = (b, principal) =>
    '<a href="' + escapar(b.url) + '" style="display:block;text-align:center;text-decoration:none;font-size:15px;font-weight:600;' +
    'padding:15px 20px;border-radius:16px;' +
    (principal
      ? 'color:#FFFFFF;background-color:' + c1 + ';background-image:linear-gradient(165deg,' + c2 + ' 0%,' + c1 + ' 55%,' + c3 + ' 100%);' +
        'border:1px solid ' + c1 + ';'
      : 'color:#1B2350;background-color:#FFFFFF;background-color:rgba(255,255,255,.7);border:1px solid #D9DEEE;') +
    '">' + escapar(b.texto) + '</a>';

  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">' +
    '<title>' + escapar(titulo) + '</title></head>' +
    '<body style="margin:0;padding:0;background-color:#ECEFFA;font-family:' + FUENTE + '">' +

    // texto de vista previa (lo que se ve en la bandeja antes de abrir)
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + escapar(intro) + '</div>' +

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ECEFFA" ' +
    'style="background-color:#ECEFFA;background-image:radial-gradient(60% 50% at 0% 0%,#C9D4FF 0%,rgba(201,212,255,0) 70%),' +
    'radial-gradient(50% 40% at 100% 30%,#E6D6FF 0%,rgba(230,214,255,0) 70%),' +
    'radial-gradient(60% 50% at 20% 100%,#CDEFF4 0%,rgba(205,239,244,0) 70%),linear-gradient(180deg,#EEF1FB,#F4F1FA);' +
    'padding:32px 14px">' +
    '<tr><td align="center">' +

    // marca
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">' +
    '<tr><td style="padding:0 6px 16px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td width="28" height="28" align="center" valign="middle" bgcolor="${MARCA}" style="width:28px;height:28px;border-radius:9px;' +
    'background-color:${MARCA};color:#FFFFFF;font-size:18px;font-weight:700;line-height:28px">+</td>' +
    '<td style="padding-left:10px;color:#1B2350;font-size:15px;font-weight:700;letter-spacing:-.2px">MediConnect</td>' +
    '</tr></table></td></tr>' +

    // tarjeta de vidrio
    '<tr><td style="background-color:#FFFFFF;background-color:rgba(255,255,255,.74);border:1px solid #FFFFFF;' +
    'border-radius:28px;box-shadow:0 24px 60px -24px rgba(24,32,80,.28);padding:10px">' +

    // cabecera de color con brillo
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td bgcolor="' + c1 + '" style="background-color:' + c1 + ';background-image:linear-gradient(150deg,' + c2 + ' 0%,' + c1 + ' 50%,' + c3 + ' 100%);' +
    'border-radius:22px;padding:26px 24px 24px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="40" height="40" align="center" valign="middle" ' +
    'style="width:40px;height:40px;border-radius:20px;background-color:#FFFFFF;background-color:rgba(255,255,255,.92);' +
    'color:' + c1 + ';font-size:20px;font-weight:700;line-height:40px">' + signo + '</td></tr></table>' +
    '<div style="color:#FFFFFF;font-size:28px;line-height:33px;font-weight:500;letter-spacing:-.6px;padding-top:16px">' + escapar(titulo) + '</div>' +

    (destacado
      ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr>' +
        '<td style="background-color:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:18px;padding:14px 16px">' +
        '<div style="color:#FFFFFF;opacity:.85;font-size:12px;font-weight:600;letter-spacing:.4px;text-transform:uppercase">' + escapar(destacado.etiqueta || '') + '</div>' +
        '<div style="color:#FFFFFF;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-.4px;padding-top:4px">' + escapar(destacado.grande || '') + '</div>' +
        (destacado.sub ? '<div style="color:#FFFFFF;opacity:.9;font-size:15px;line-height:21px;padding-top:2px">' + escapar(destacado.sub) + '</div>' : '') +
        '</td></tr></table>'
      : '') +
    '</td></tr></table>' +

    // cuerpo
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="padding:22px 18px 6px;color:#12131A;font-size:17px;font-weight:600">' + escapar(saludo) + '</td></tr>' +
    '<tr><td style="padding:0 18px 16px;color:#4E5465;font-size:15px;line-height:23px">' + escapar(intro) + '</td></tr>' +

    (filas && filas.length
      ? '<tr><td style="padding:0 10px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
        'style="background-color:#F6F7FC;background-color:rgba(246,247,252,.85);border:1px solid #EAEDF6;border-radius:20px;padding:4px 16px">' +
        filas.map((f, k) => fila(f[0], f[1], k === filas.length - 1)).join('') + '</table></td></tr>'
      : '') +

    (boton ? '<tr><td style="padding:14px 10px 0">' + btn(boton, true) + '</td></tr>' : '') +
    (boton2 ? '<tr><td style="padding:10px 10px 0">' + btn(boton2, false) + '</td></tr>' : '') +

    (aviso
      ? '<tr><td style="padding:16px 10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="background-color:#FFF5E3;border:1px solid #F7E2B8;border-radius:16px;padding:13px 15px;' +
        'color:#7A4A00;font-size:13px;line-height:19px">' + escapar(aviso) + '</td></tr></table></td></tr>'
      : '') +

    '<tr><td style="padding:20px 18px 14px;color:#7A7F8E;font-size:12px;line-height:18px">' + escapar(pie || '') + '</td></tr>' +
    '</table>' +

    '</td></tr>' +   // fin tarjeta

    '<tr><td style="padding:18px 16px 0;color:#8A8F9E;font-size:11px;line-height:17px;text-align:center">' +
    'MediConnect es un prototipo académico de estudiantes.<br>La clínica, los médicos y los pagos son ficticios.' +
    '</td></tr>' +
    '</table>' +
    '</td></tr></table></body></html>';
}
`;

/* ============================================================
   MC-01 · Registro
   ============================================================ */
const codigoRegistro = BIBLIOTECA + `
/* ---------- MC-01 · validar el registro y armar la bienvenida ---------- */
const _entrada = $input.first().json || {};
const e = _entrada.body && typeof _entrada.body === 'object' ? _entrada.body : _entrada;   // el Webhook de n8n entrega el JSON dentro de .body
const salida = { ok: false, enviar: false, evento: e.evento || 'desconocido', idEvento: e.idEvento || null };

// 1 · Es solo una prueba de conexión desde la app
if (e.prueba === true){
  return [{ json: { ...salida, ok: true, motivo: 'prueba', respuesta: { ok: true, mensaje: 'Conexión correcta con MediConnect' } } }];
}

// 2 · Validaciones
const errores = [];
if (e.evento !== 'registro') errores.push('evento inesperado: ' + e.evento);
if (!esCorreo(e.paciente && e.paciente.correo)) errores.push('correo inválido o ausente');
if (errores.length){
  return [{ json: { ...salida, motivo: 'inválido', errores,
    respuesta: { ok: false, error: 'Evento inválido', detalle: errores } } }];
}

// 3 · Idempotencia
if (yaProcesado(e.idEvento)){
  return [{ json: { ...salida, ok: true, motivo: 'duplicado',
    respuesta: { ok: true, duplicado: true, mensaje: 'Este evento ya se había procesado' } } }];
}

// 4 · Correo de bienvenida
const nombre = (e.paciente.nombre || 'Hola').split(' ')[0];
return [{ json: {
  ...salida,
  ok: true,
  enviar: true,
  para: e.paciente.correo,
  asunto: 'Tu cuenta de MediConnect está lista',
  html: correoHtml({
    titulo: 'Tu cuenta está lista',
    saludo: '¡Hola, ' + nombre + '!',
    intro: 'Ya podés agendar, cambiar y consultar tus citas desde MediConnect. ' +
           'Cuando reservés, te mandamos la confirmación con el archivo para tu calendario y tu código de llegada.',
    filas: [['Correo', e.paciente.correo], ['Zona horaria', (e.zona && e.zona.id) || 'America/El_Salvador']],
    boton: e.app && e.app.url ? { texto: 'Abrir MediConnect', url: e.app.url } : null,
    aviso: 'Este es un proyecto académico: no respondas con información médica real.',
    pie: 'Recibiste este correo porque creaste una cuenta en MediConnect.'
  }),
  respuesta: { ok: true, mensaje: 'Bienvenida enviada' }
} }];
`;

const codigoRegistrarResultado = `
/* ---------- registrar el resultado del envío ---------- */
// Lo que sale de Gmail es su propia respuesta; los datos del aviso vienen del nodo anterior a Gmail.
let previo = {};
for (const nombre of ['Validar y preparar', '¿A quién le toca?']){
  try { previo = $(nombre).first().json || {}; break; } catch (_) { /* ese nodo no existe en este flujo */ }
}
const gmail = $input.first().json || {};
const e = Object.assign({}, previo, (gmail.evento || gmail.para || gmail.error) ? gmail : {});
const falló = !!e.error;
const guardado = $getWorkflowStaticData('global');
guardado.bitacora = guardado.bitacora || [];
guardado.bitacora.push({
  cuando: new Date().toISOString(),
  evento: e.evento || null,
  idEvento: e.idEvento || null,
  para: e.para || null,
  resultado: falló ? 'error' : 'enviado',
  detalle: falló ? String(e.error.message || e.error) : null
});
if (guardado.bitacora.length > 200) guardado.bitacora.splice(0, guardado.bitacora.length - 200);

return [{ json: {
  ...e,
  respuesta: falló
    ? { ok: false, error: 'No se pudo enviar el correo', detalle: String(e.error.message || e.error) }
    : { ok: true, mensaje: 'Correo enviado' }
} }];
`;

function flujoRegistro(){
  const n = [
    webhook('Recibe el registro', 'mediconnect/registro', [-200, 0]),
    code('Validar y preparar', codigoRegistro, [40, 0]),
    si('¿Hay que enviar?', '={{ $json.enviar }}', [280, 0]),
    gmail('Enviar bienvenida (Gmail)', [520, -100], false),
    code('Registrar resultado', codigoRegistrarResultado, [760, -100]),
    responder('Responder a la app', [1000, -100]),
    responder('Responder sin enviar', [520, 120])
  ];
  return flujo('MC-01 · Registro (bienvenida)', n, conectar([
    ['Recibe el registro', 'Validar y preparar'],
    ['Validar y preparar', '¿Hay que enviar?'],
    ['¿Hay que enviar?', 'Enviar bienvenida (Gmail)', 0],
    ['¿Hay que enviar?', 'Responder sin enviar', 1],
    ['Enviar bienvenida (Gmail)', 'Registrar resultado'],
    ['Registrar resultado', 'Responder a la app']
  ]), [
    'Recibe el evento de registro de la app, valida el correo, descarta repetidos',
    'y manda la bienvenida con tu Gmail personal. Si el correo falla, igual responde',
    'a la app con el error, para que la pantalla diga la verdad.'
  ]);
}

/* ============================================================
   MC-02 · Reserva
   ============================================================ */
const codigoReserva = BIBLIOTECA + `
/* ---------- MC-02 · validar la reserva y armar la confirmación ---------- */
const _entrada = $input.first().json || {};
const e = _entrada.body && typeof _entrada.body === 'object' ? _entrada.body : _entrada;   // el Webhook de n8n entrega el JSON dentro de .body
const salida = { ok: false, enviar: false, evento: e.evento || 'desconocido', idEvento: e.idEvento || null };

const errores = [];
if (e.evento !== 'reserva') errores.push('evento inesperado: ' + e.evento);
if (!esCorreo(e.paciente && e.paciente.correo)) errores.push('correo inválido o ausente');
const c = e.cita || {};
if (!c.codigo) errores.push('falta el código de la cita');
if (!c.fecha || !c.hora) errores.push('falta la fecha o la hora');
if (!c.medico || !c.medico.nombre) errores.push('falta el médico');
if (c.estado && c.estado !== 'agendada') errores.push('la cita no está agendada: ' + c.estado);

if (errores.length){
  return [{ json: { ...salida, motivo: 'inválido', errores,
    respuesta: { ok: false, error: 'Evento inválido', detalle: errores } } }];
}

if (yaProcesado(e.idEvento)){
  return [{ json: { ...salida, ok: true, motivo: 'duplicado',
    respuesta: { ok: true, duplicado: true, mensaje: 'Esa confirmación ya se había enviado' } } }];
}

const nombre = (e.paciente.nombre || 'Hola').split(' ')[0];
const lugar = (c.lugar && c.lugar.clinica) || 'Centro Médico MediConnect';
const direccion = (c.lugar && c.lugar.direccion) || '';
const enlaces = c.enlaces || {};

const html = correoHtml({
  titulo: c.esControl ? 'Tu control está agendado' : 'Tu cita está confirmada',
  saludo: '¡Listo, ' + nombre + '!',
  intro: 'Guardamos tu ' + (c.esControl ? 'control' : 'cita') + ' con ' + c.medico.nombre +
         '. Te adjuntamos el archivo para tu calendario y abajo está tu comprobante con el código de llegada.',
  filas: [
    ['Médico', c.medico.nombre + ' · ' + (c.medico.especialidad || '')],
    ['Fecha', c.fechaTexto || c.fecha],
    ['Hora', (c.horaTexto || c.hora) + ' (' + ((e.zona && e.zona.id) || 'America/El_Salvador') + ')'],
    ['Lugar', lugar + (c.medico.consultorio ? ' · ' + c.medico.consultorio : '')],
    ['Dirección', direccion],
    ['Código', c.codigo]
  ].filter(f => f[1]),
  destacado: { etiqueta: c.esControl ? 'Tu control' : 'Tu cita',
               grande: c.fechaTexto || c.fecha,
               sub: (c.horaTexto || c.hora) + ' · ' + c.medico.nombre },
  boton: enlaces.comprobante ? { texto: 'Ver mi comprobante y QR', url: enlaces.comprobante } : null,
  boton2: enlaces.calendarioGoogle ? { texto: 'Agregar a Google Calendar', url: enlaces.calendarioGoogle } : null,
  aviso: 'Llegá 10 minutos antes y hacé el check-in con el QR. Podés cambiar o cancelar hasta 4 horas antes.',
  pie: 'También te adjuntamos el archivo .ics: abrilo para guardarla en el calendario de tu teléfono.'
});

const resultado = {
  ...salida,
  ok: true,
  enviar: true,
  para: e.paciente.correo,
  asunto: (c.esControl ? 'Control agendado' : 'Cita confirmada') + ': ' +
          (c.fechaTexto || c.fecha) + ', ' + (c.horaTexto || c.hora) + ' · ' + c.medico.nombre,
  html,
  codigo: c.codigo,
  respuesta: { ok: true, mensaje: 'Confirmación enviada', codigo: c.codigo }
};

// El archivo .ics viene como texto desde la app; aquí se vuelve adjunto
if (typeof e.ics === 'string' && e.ics.length > 40){
  return [{
    json: resultado,
    binary: {
      ics: {
        data: Buffer.from(e.ics, 'utf8').toString('base64'),
        mimeType: 'text/calendar',
        fileName: e.icsNombre || ('mediconnect-' + c.codigo + '.ics'),
        fileExtension: 'ics'
      }
    }
  }];
}
return [{ json: resultado }];
`;

function flujoReserva(){
  const n = [
    webhook('Recibe la reserva', 'mediconnect/reserva', [-200, 0]),
    code('Validar y preparar', codigoReserva, [40, 0]),
    si('¿Hay que enviar?', '={{ $json.enviar }}', [280, 0]),
    gmail('Enviar confirmación (Gmail)', [520, -100], true),
    code('Registrar resultado', codigoRegistrarResultado, [760, -100]),
    responder('Responder a la app', [1000, -100]),
    responder('Responder sin enviar', [520, 120])
  ];
  return flujo('MC-02 · Reserva (confirmación + .ics)', n, conectar([
    ['Recibe la reserva', 'Validar y preparar'],
    ['Validar y preparar', '¿Hay que enviar?'],
    ['¿Hay que enviar?', 'Enviar confirmación (Gmail)', 0],
    ['¿Hay que enviar?', 'Responder sin enviar', 1],
    ['Enviar confirmación (Gmail)', 'Registrar resultado'],
    ['Registrar resultado', 'Responder a la app']
  ]), [
    'Recibe una cita YA guardada por la app, valida sus datos y envía la confirmación',
    'por Gmail con profesional, fecha, hora, lugar, enlace al comprobante y el archivo .ics adjunto.',
    'Descarta eventos repetidos por la clave idEvento.'
  ]);
}

/* ============================================================
   MC-03 · Cambio y cancelacion
   ============================================================ */
const codigoCambio = BIBLIOTECA + `
/* ---------- MC-03 · cambio o cancelación ---------- */
const _entrada = $input.first().json || {};
const e = _entrada.body && typeof _entrada.body === 'object' ? _entrada.body : _entrada;   // el Webhook de n8n entrega el JSON dentro de .body
const esCancelacion = e.evento === 'cancelacion';
const salida = { ok: false, enviar: false, evento: e.evento || 'desconocido', idEvento: e.idEvento || null };

const errores = [];
if (e.evento !== 'cambio' && e.evento !== 'cancelacion') errores.push('evento inesperado: ' + e.evento);
if (!esCorreo(e.paciente && e.paciente.correo)) errores.push('correo inválido o ausente');
const c = e.cita || {};
if (!c.codigo) errores.push('falta el código de la cita');
if (esCancelacion && c.estado !== 'cancelada') errores.push('la cita no figura como cancelada');
if (!esCancelacion && c.estado === 'cancelada') errores.push('no se puede notificar un cambio de una cita cancelada');

if (errores.length){
  return [{ json: { ...salida, motivo: 'inválido', errores,
    respuesta: { ok: false, error: 'Evento inválido', detalle: errores } } }];
}
if (yaProcesado(e.idEvento)){
  return [{ json: { ...salida, ok: true, motivo: 'duplicado',
    respuesta: { ok: true, duplicado: true, mensaje: 'Ese aviso ya se había enviado' } } }];
}

const nombre = (e.paciente.nombre || 'Hola').split(' ')[0];
const enlaces = c.enlaces || {};
const antes = e.anterior;

const html = esCancelacion
  ? correoHtml({
      titulo: 'Cita cancelada',
      tono: 'danger',
      destacado: { etiqueta: 'Ya no está agendada', grande: (c.fechaTexto || c.fecha), sub: (c.horaTexto || c.hora) + ' · ' + ((c.medico && c.medico.nombre) || '') },
      saludo: 'Hola, ' + nombre,
      intro: 'Cancelamos tu cita con ' + ((c.medico && c.medico.nombre) || 'tu médico') +
             '. El horario quedó libre para otra persona y no hay ningún cargo.',
      filas: [
        ['Cita', c.codigo],
        ['Era el', (c.fechaTexto || c.fecha) + ', ' + (c.horaTexto || c.hora)],
        ['Motivo', e.razon || 'Cancelada por el paciente']
      ],
      boton: e.app && e.app.url ? { texto: 'Agendar otra cita', url: e.app.url } : null,
      aviso: 'El código ' + c.codigo + ' ya no sirve para hacer check-in.',
      pie: 'Si no fuiste vos quien canceló, escribinos o llamá a la clínica.'
    })
  : correoHtml({
      titulo: 'Cambiamos tu cita',
      saludo: 'Listo, ' + nombre,
      intro: 'Tu cita con ' + ((c.medico && c.medico.nombre) || 'tu médico') + ' quedó para otra fecha. ' +
             'Te adjuntamos el calendario actualizado.',
      filas: [
        ['Antes', antes ? (antes.fechaTexto + ', ' + antes.horaTexto) : '—'],
        ['Ahora', (c.fechaTexto || c.fecha) + ', ' + (c.horaTexto || c.hora)],
        ['Médico', (c.medico && c.medico.nombre) || ''],
        ['Lugar', ((c.lugar && c.lugar.clinica) || '') + ((c.medico && c.medico.consultorio) ? ' · ' + c.medico.consultorio : '')],
        ['Código', c.codigo]
      ].filter(f => f[1] && f[1] !== '—' || f[0] === 'Antes'),
      destacado: { etiqueta: 'Nueva fecha', grande: (c.fechaTexto || c.fecha), sub: (c.horaTexto || c.hora) + ' · ' + ((c.medico && c.medico.nombre) || '') },
      boton: enlaces.comprobante ? { texto: 'Ver mi comprobante y QR', url: enlaces.comprobante } : null,
      boton2: enlaces.calendarioGoogle ? { texto: 'Actualizar en Google Calendar', url: enlaces.calendarioGoogle } : null,
      aviso: 'Tu código de llegada sigue siendo el mismo: ' + c.codigo + '.',
      pie: 'Te adjuntamos el calendario actualizado (.ics).'
    });

const resultado = {
  ...salida,
  ok: true,
  enviar: true,
  para: e.paciente.correo,
  asunto: esCancelacion
    ? 'Cita cancelada · ' + c.codigo
    : 'Cita cambiada: ' + (c.fechaTexto || c.fecha) + ', ' + (c.horaTexto || c.hora),
  html,
  codigo: c.codigo,
  respuesta: { ok: true, mensaje: esCancelacion ? 'Aviso de cancelación enviado' : 'Aviso de cambio enviado' }
};

if (!esCancelacion && typeof e.ics === 'string' && e.ics.length > 40){
  return [{
    json: resultado,
    binary: {
      ics: {
        data: Buffer.from(e.ics, 'utf8').toString('base64'),
        mimeType: 'text/calendar',
        fileName: e.icsNombre || ('mediconnect-' + c.codigo + '.ics'),
        fileExtension: 'ics'
      }
    }
  }];
}
return [{ json: resultado }];
`;

function flujoCambio(){
  const n = [
    webhook('Recibe el cambio', 'mediconnect/cambio', [-200, -120]),
    webhook('Recibe la cancelación', 'mediconnect/cancelacion', [-200, 120]),
    code('Validar y preparar', codigoCambio, [60, 0]),
    si('¿Hay que enviar?', '={{ $json.enviar }}', [300, 0]),
    gmail('Enviar aviso (Gmail)', [540, -100], true),
    code('Registrar resultado', codigoRegistrarResultado, [780, -100]),
    responder('Responder a la app', [1020, -100]),
    responder('Responder sin enviar', [540, 120])
  ];
  return flujo('MC-03 · Cambio y cancelación', n, conectar([
    ['Recibe el cambio', 'Validar y preparar'],
    ['Recibe la cancelación', 'Validar y preparar'],
    ['Validar y preparar', '¿Hay que enviar?'],
    ['¿Hay que enviar?', 'Enviar aviso (Gmail)', 0],
    ['¿Hay que enviar?', 'Responder sin enviar', 1],
    ['Enviar aviso (Gmail)', 'Registrar resultado'],
    ['Registrar resultado', 'Responder a la app']
  ]), [
    'Dos webhooks, un solo camino: avisa el cambio de fecha (con .ics nuevo) o la cancelación.',
    'Comprueba que el estado que manda la app coincida con el aviso, para no decir una cosa',
    'por otra, y mantiene el mismo código de cita en los dos casos.'
  ]);
}

/* ============================================================
   MC-04 · Recordatorio
   ============================================================ */
const codigoProgramar = `
/* ---------- MC-04a · guardar o quitar un recordatorio ---------- */
const _entrada = $input.first().json || {};
const e = _entrada.body && typeof _entrada.body === 'object' ? _entrada.body : _entrada;   // el Webhook de n8n entrega el JSON dentro de .body
const guardado = $getWorkflowStaticData('global');
guardado.pendientes = guardado.pendientes || {};

const c = e.cita || {};
if (!c.codigo){
  return [{ json: { respuesta: { ok: false, error: 'Falta el código de la cita' } } }];
}

// Cancelar un recordatorio pendiente
if (e.accion === 'cancelar' || c.estado === 'cancelada'){
  const habia = !!guardado.pendientes[c.codigo];
  delete guardado.pendientes[c.codigo];
  return [{ json: { respuesta: { ok: true, mensaje: habia ? 'Recordatorio descartado' : 'No había recordatorio pendiente' } } }];
}

const minutos = Number(e.enMinutos);
if (!Number.isFinite(minutos) || minutos < 0 || minutos > 60 * 24 * 60){
  return [{ json: { respuesta: { ok: false, error: 'enMinutos fuera de rango' } } }];
}

// Un solo recordatorio por cita: si ya había, se reemplaza (reprogramación)
guardado.pendientes[c.codigo] = {
  cuando: Date.now() + minutos * 60000,
  enviado: false,
  para: (e.paciente && e.paciente.correo) || null,
  nombre: (e.paciente && e.paciente.nombre) || '',
  cita: c,
  zona: e.zona || null,
  app: e.app || null
};

return [{ json: { respuesta: {
  ok: true,
  mensaje: 'Recordatorio programado',
  codigo: c.codigo,
  enMinutos: minutos,
  pendientes: Object.keys(guardado.pendientes).length
} } }];
`;

const codigoRevisar = BIBLIOTECA + `
/* ---------- MC-04b · ¿a quién le toca el recordatorio? ---------- */
const guardado = $getWorkflowStaticData('global');
guardado.pendientes = guardado.pendientes || {};
const ahora = Date.now();
const salida = [];

for (const [codigo, p] of Object.entries(guardado.pendientes)){
  // Limpieza: lo que quedó viejo se descarta
  if (p.cuando < ahora - 6 * 3600000){ delete guardado.pendientes[codigo]; continue; }
  if (p.enviado) continue;
  if (p.cuando > ahora) continue;
  if (!esCorreo(p.para)) { delete guardado.pendientes[codigo]; continue; }
  if (p.cita && p.cita.estado === 'cancelada'){ delete guardado.pendientes[codigo]; continue; }

  // Se marca ANTES de enviar: si algo falla, no se reenvía en bucle
  p.enviado = true;

  const c = p.cita || {};
  const nombre = (p.nombre || 'Hola').split(' ')[0];
  const enlaces = c.enlaces || {};

  salida.push({ json: {
    enviar: true,
    evento: 'recordatorio',
    idEvento: 'rec-' + codigo,
    codigo,
    para: p.para,
    asunto: 'Recordatorio: tu cita es ' + (c.fechaTexto || c.fecha) + ' a las ' + (c.horaTexto || c.hora),
    html: correoHtml({
      titulo: 'Tu cita es pronto',
    destacado: { etiqueta: 'Te esperamos', grande: (c.fechaTexto || c.fecha), sub: (c.horaTexto || c.hora) + ' · ' + ((c.medico && c.medico.nombre) || '') },
      saludo: 'Hola, ' + nombre,
      intro: 'Te recordamos tu cita con ' + ((c.medico && c.medico.nombre) || 'tu médico') +
             '. Llegá 10 minutos antes y hacé el check-in con el QR de tu comprobante.',
      filas: [
        ['Fecha', c.fechaTexto || c.fecha],
        ['Hora', (c.horaTexto || c.hora) + ' (' + ((p.zona && p.zona.id) || 'America/El_Salvador') + ')'],
        ['Médico', (c.medico && c.medico.nombre) || ''],
        ['Lugar', ((c.lugar && c.lugar.clinica) || '') + ((c.medico && c.medico.consultorio) ? ' · ' + c.medico.consultorio : '')],
        ['Código', codigo]
      ].filter(f => f[1]),
      boton: enlaces.comprobante ? { texto: 'Abrir mi comprobante', url: enlaces.comprobante } : null,
      aviso: '¿No vas a poder llegar? Cancelá desde la app para liberar el horario.',
      pie: 'Recordatorio automático de MediConnect.'
    })
  } });
}

return salida;
`;

function flujoRecordatorio(){
  const n = [
    webhook('Recibe el recordatorio', 'mediconnect/recordatorio', [-220, 160]),
    code('Programar o descartar', codigoProgramar, [20, 160]),
    responder('Responder a la app', [260, 160]),

    disparadorHorario('Cada minuto', [-220, -140]),
    code('¿A quién le toca?', codigoRevisar, [20, -140]),
    gmail('Enviar recordatorio (Gmail)', [260, -140], false),
    code('Registrar resultado', codigoRegistrarResultado, [500, -140]),
    noop('Listo', [740, -140])
  ];
  return flujo('MC-04 · Recordatorio', n, conectar([
    ['Recibe el recordatorio', 'Programar o descartar'],
    ['Programar o descartar', 'Responder a la app'],
    ['Cada minuto', '¿A quién le toca?'],
    ['¿A quién le toca?', 'Enviar recordatorio (Gmail)'],
    ['Enviar recordatorio (Gmail)', 'Registrar resultado'],
    ['Registrar resultado', 'Listo']
  ]), [
    'Dos entradas en el mismo flujo, que comparten memoria:',
    '  · el webhook guarda (o quita) el recordatorio de una cita;',
    '  · el disparador de cada minuto revisa cuáles ya toca enviar.',
    'Marca el envío ANTES de mandar el correo, así nunca se repite; y descarta',
    'las citas canceladas. IMPORTANTE: este flujo tiene que quedar ACTIVO en n8n.'
  ]);
}

/* ============================================================
   MC-04 · Recordatorio · VERSION PARA n8n CLOUD
   ------------------------------------------------------------
   En n8n Cloud cada ejecucion de produccion cuenta para el cupo
   del plan (la prueba gratis trae 1.000). Un disparador "cada
   minuto" gastaria 1.440 al dia y agotaria la prueba en horas.

   Por eso esta version NO usa disparador de tiempo:
     1. el webhook guarda el recordatorio, responde a la app y
        TERMINA (n8n solo guarda la memoria del flujo al terminar
        una ejecucion; una que se queda dormida no la guarda);
     2. antes de terminar, le encarga la espera a un segundo
        webhook del mismo flujo, que responde enseguida y se queda
        dormido en un nodo Wait hasta la hora (dormir no gasta);
     3. al despertar le pregunta al propio flujo, por un tercer
        webhook, si el recordatorio sigue vigente (pudo cancelarse
        o reprogramarse mientras dormia). Esa consulta lee la
        memoria fresca, marca el envio y devuelve el correo armado;
     4. solo si sigue vigente, Gmail lo manda.

   La ejecucion que duerme no escribe en la memoria del flujo
   (lleva una copia vieja y la pisaria). Todo lo que se anota,
   se anota en la consulta del paso 3.

   Costo: 3 ejecuciones por recordatorio, 1 por cancelacion.
   ============================================================ */
const codigoProgramarCloud = `
/* ---------- MC-04a (cloud) · guardar o quitar un recordatorio ---------- */
const entrada = $input.first().json || {};
const e = entrada.body && typeof entrada.body === 'object' ? entrada.body : entrada;
const cabeceras = entrada.headers || {};
const guardado = $getWorkflowStaticData('global');
guardado.pendientes = guardado.pendientes || {};

const c = e.cita || {};
if (!c.codigo){
  return [{ json: { esperar: false, respuesta: { ok: false, error: 'Falta el código de la cita' } } }];
}

if (e.accion === 'cancelar' || c.estado === 'cancelada'){
  const habia = !!guardado.pendientes[c.codigo];
  delete guardado.pendientes[c.codigo];
  return [{ json: { esperar: false, respuesta: { ok: true, mensaje: habia ? 'Recordatorio descartado' : 'No había recordatorio pendiente' } } }];
}

const minutos = Number(e.enMinutos);
if (!Number.isFinite(minutos) || minutos < 0 || minutos > 60 * 24 * 60){
  return [{ json: { esperar: false, respuesta: { ok: false, error: 'enMinutos fuera de rango' } } }];
}

const correo = (e.paciente && e.paciente.correo) || null;
if (typeof correo !== 'string' || !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$/.test(correo)){
  return [{ json: { esperar: false, respuesta: { ok: false, error: 'El correo del paciente no es válido' } } }];
}

// Limpieza de lo viejo
for (const [k, p] of Object.entries(guardado.pendientes)){
  if (p.cuando < Date.now() - 2 * 86400000) delete guardado.pendientes[k];
}

const cuando = Date.now() + minutos * 60000;
// La ficha: si se reprograma, cambia, y la ejecución vieja que está dormida ya no vale
const ficha = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

guardado.pendientes[c.codigo] = {
  cuando, ficha, enviado: false,
  para: correo,
  nombre: (e.paciente && e.paciente.nombre) || '',
  cita: c,
  zona: e.zona || null,
  app: e.app || null
};

const host = cabeceras['x-forwarded-host'] || cabeceras.host || '';
return [{ json: {
  esperar: true,
  codigo: c.codigo,
  ficha,
  cuandoIso: new Date(cuando).toISOString(),
  consulta: host ? 'https://' + host + '/webhook/mediconnect/recordatorio-vigente' : '',
  espera: host ? 'https://' + host + '/webhook/mediconnect/recordatorio-esperar' : '',
  respuesta: { ok: true, mensaje: 'Recordatorio programado', codigo: c.codigo, enMinutos: minutos }
} }];
`;

const codigoVigenteCloud = BIBLIOTECA + `
/* ---------- MC-04b (cloud) · ¿sigue vigente? ---------- */
const entrada = $input.first().json || {};
const e = entrada.body && typeof entrada.body === 'object' ? entrada.body : entrada;
const guardado = $getWorkflowStaticData('global');
guardado.pendientes = guardado.pendientes || {};

const no = (motivo) => [{ json: { respuesta: { enviar: false, motivo } } }];

const p = guardado.pendientes[e.codigo];
if (!p) return no('ya no hay recordatorio para esa cita');
if (p.ficha !== e.ficha) return no('la cita se reprogramó: este recordatorio ya no vale');
if (p.enviado) return no('ya se envió');
if (p.cita && p.cita.estado === 'cancelada') { delete guardado.pendientes[e.codigo]; return no('cita cancelada'); }
if (!esCorreo(p.para)) { delete guardado.pendientes[e.codigo]; return no('correo inválido'); }
if (p.cuando > Date.now() + 5000) return no('todavía no es la hora');

// Se marca ANTES de enviar: nunca se repite
p.enviado = true;
p.enviadoEn = new Date().toISOString();

const codigo = e.codigo;
const c = p.cita || {};
const nombre = (p.nombre || 'Hola').split(' ')[0];
const enlaces = c.enlaces || {};

return [{ json: { respuesta: {
  enviar: true,
  evento: 'recordatorio',
  idEvento: 'rec-' + codigo,
  codigo,
  para: p.para,
  asunto: 'Recordatorio: tu cita es ' + (c.fechaTexto || c.fecha) + ' a las ' + (c.horaTexto || c.hora),
  html: correoHtml({
    titulo: 'Tu cita es pronto',
    destacado: { etiqueta: 'Te esperamos', grande: (c.fechaTexto || c.fecha), sub: (c.horaTexto || c.hora) + ' · ' + ((c.medico && c.medico.nombre) || '') },
    saludo: 'Hola, ' + nombre,
    intro: 'Te recordamos tu cita con ' + ((c.medico && c.medico.nombre) || 'tu médico') +
           '. Llegá 10 minutos antes y hacé el check-in con el QR de tu comprobante.',
    filas: [
      ['Fecha', c.fechaTexto || c.fecha],
      ['Hora', (c.horaTexto || c.hora) + ' (' + ((p.zona && p.zona.id) || 'America/El_Salvador') + ')'],
      ['Médico', (c.medico && c.medico.nombre) || ''],
      ['Lugar', ((c.lugar && c.lugar.clinica) || '') + ((c.medico && c.medico.consultorio) ? ' · ' + c.medico.consultorio : '')],
      ['Código', codigo]
    ].filter(f => f[1]),
    boton: enlaces.comprobante ? { texto: 'Abrir mi comprobante', url: enlaces.comprobante } : null,
    aviso: '¿No vas a poder llegar? Cancelá desde la app para liberar el horario.',
    pie: 'Recordatorio automático de MediConnect.'
  })
} } }];
`;

const esperarHasta = (nombre, posicion) => nodo(nombre, 'n8n-nodes-base.wait', {
  resume: 'specificTime',
  dateTime: '={{ $json.body.cuandoIso }}'
}, { typeVersion: 1.1, position: posicion, resto: { webhookId: id('wait-recordatorio') } });

const postJson = (nombre, url, cuerpo, posicion) => nodo(nombre, 'n8n-nodes-base.httpRequest', {
  method: 'POST',
  url,
  sendBody: true,
  specifyBody: 'json',
  jsonBody: cuerpo,
  options: { timeout: 15000 }
}, { typeVersion: 4.2, position: posicion, resto: { onError: 'continueRegularOutput' } });

/* Webhook que responde apenas recibe (no espera al final del flujo) */
const webhookInmediato = (nombre, ruta, posicion) => nodo(nombre, 'n8n-nodes-base.webhook', {
  httpMethod: 'POST',
  path: ruta,
  responseMode: 'onReceived',
  options: {}
}, { typeVersion: 2, position: posicion, resto: { webhookId: id('wh-' + ruta) } });

const responderTal = (nombre, posicion) => nodo(nombre, 'n8n-nodes-base.respondToWebhook', {
  respondWith: 'json',
  responseBody: '={{ JSON.stringify($json.respuesta) }}',
  options: {}
}, { typeVersion: 1, position: posicion });

function flujoRecordatorioCloud(){
  const n = [
    webhook('Recibe el recordatorio', 'mediconnect/recordatorio', [-220, 160]),
    code('Programar o descartar', codigoProgramarCloud, [20, 160]),
    responder('Responder a la app', [260, 160]),
    si('¿Hay que esperar?', '={{ $json.esperar === true }}', [500, 160]),
    postJson('Encargar la espera', '={{ $json.espera }}',
      '={{ JSON.stringify({ codigo: $json.codigo, ficha: $json.ficha, cuandoIso: $json.cuandoIso, consulta: $json.consulta }) }}', [740, 140]),
    noop('Listo', [740, 340]),

    webhookInmediato('Recibe la espera', 'mediconnect/recordatorio-esperar', [-220, 520]),
    esperarHasta('Dormir hasta la hora', [20, 520]),
    postJson('¿Sigue vigente?', '={{ $json.body.consulta }}',
      '={{ JSON.stringify({ codigo: $json.body.codigo, ficha: $json.body.ficha }) }}', [260, 520]),
    si('¿Se envía?', '={{ $json.enviar === true }}', [500, 520]),
    gmail('Enviar recordatorio (Gmail)', [740, 500], false),
    noop('Nada que enviar', [740, 700]),

    webhook('Consulta de vigencia', 'mediconnect/recordatorio-vigente', [-220, 880]),
    code('Revisar y marcar', codigoVigenteCloud, [20, 880]),
    responderTal('Responder la consulta', [260, 880])
  ];
  return flujo('MC-04 · Recordatorio (n8n Cloud)', n, conectar([
    ['Recibe el recordatorio', 'Programar o descartar'],
    ['Programar o descartar', 'Responder a la app'],
    ['Responder a la app', '¿Hay que esperar?'],
    ['¿Hay que esperar?', 'Encargar la espera', 0],
    ['¿Hay que esperar?', 'Listo', 1],
    ['Recibe la espera', 'Dormir hasta la hora'],
    ['Dormir hasta la hora', '¿Sigue vigente?'],
    ['¿Sigue vigente?', '¿Se envía?'],
    ['¿Se envía?', 'Enviar recordatorio (Gmail)', 0],
    ['¿Se envía?', 'Nada que enviar', 1],
    ['Consulta de vigencia', 'Revisar y marcar'],
    ['Revisar y marcar', 'Responder la consulta']
  ]), [
    'Versión para n8n Cloud: sin disparador de cada minuto (gastaría el cupo de ejecuciones).',
    'Fila 1: guarda el recordatorio, responde y TERMINA (así n8n guarda la memoria).',
    'Fila 2: duerme hasta la hora y pregunta si sigue vigente. Fila 3: responde esa pregunta',
    'con la memoria fresca. IMPORTANTE: este flujo tiene que quedar ACTIVO (publicado).'
  ]);
}

/* ============================================================
   Escritura
   ============================================================ */
const archivos = [
  ['MC-01-registro.json', flujoRegistro()],
  ['MC-02-reserva.json', flujoReserva()],
  ['MC-03-cambio-cancelacion.json', flujoCambio()],
  ['MC-04-recordatorio.json', flujoRecordatorio()]
];

for (const [nombre, contenido] of archivos){
  const destino = path.join(SALIDA, nombre);
  fs.writeFileSync(destino, JSON.stringify(contenido, null, 2) + '\n', 'utf8');
  console.log('escrito  ' + nombre + '  (' + contenido.nodes.length + ' nodos)');
}

/* Juego completo para n8n Cloud: MC-01 a MC-03 iguales, MC-04 sin disparador de tiempo */
const CLOUD = path.join(SALIDA, 'cloud');
fs.mkdirSync(CLOUD, { recursive: true });
const archivosCloud = [
  ['MC-01-registro.json', JSON.parse(JSON.stringify(archivos[0][1]))],
  ['MC-02-reserva.json', JSON.parse(JSON.stringify(archivos[1][1]))],
  ['MC-03-cambio-cancelacion.json', JSON.parse(JSON.stringify(archivos[2][1]))],
  ['MC-04-recordatorio-cloud.json', flujoRecordatorioCloud()]
];
for (const [nombre, contenido] of archivosCloud){
  fs.writeFileSync(path.join(CLOUD, nombre), JSON.stringify(contenido, null, 2) + '\n', 'utf8');
  console.log('escrito  cloud/' + nombre + '  (' + contenido.nodes.length + ' nodos)');
}
console.log('\nListo. Importá estos archivos en n8n con  Workflows → Import from File.');
