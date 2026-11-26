/* ============================================================
   MediConnect · calendario.js
   Agregar la cita al calendario, de verdad:
     · se arma un archivo .ics valido (la norma RFC 5545) y se descarga;
     · o se abre el enlace de Google Calendar ya con los datos puestos.

   Lo que NO hacemos (y por eso la app no lo dice): crear el evento
   solo en el calendario personal de alguien. Eso exigiria que la
   persona autorice su cuenta de Google, y no es parte del alcance.
   Por eso el boton dice "Descargar para el calendario" y el aviso
   posterior dice que se descargo el archivo, no que quedo agregada.
   ============================================================ */

import { APP, ZONA } from './config.js';
import { aInstante, selloIcs, fechaLarga, hora12 } from './fechas.js';
import { medico } from './datos.js';

/** Las lineas de un .ics no pueden pasar de 75 octetos: se parten asi */
function plegar(linea){
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;
  const partes = [];
  let actual = '';
  let largo = 0;
  for (const ch of linea){
    const n = new TextEncoder().encode(ch).length;
    const tope = partes.length === 0 ? 75 : 74;   // las continuaciones llevan un espacio
    if (largo + n > tope){ partes.push(actual); actual = ''; largo = 0; }
    actual += ch; largo += n;
  }
  if (actual) partes.push(actual);
  return partes[0] + partes.slice(1).map(p => '\r\n ' + p).join('');
}

/** Caracteres que hay que escapar dentro de un valor de texto */
const escapar = (t) => String(t || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/* ------------------------------------------------------------
   Datos del evento a partir de una cita
   ------------------------------------------------------------ */
export function eventoDeCita(cita, { urlComprobante } = {}){
  const doc = medico(cita.medicoId);
  const inicio = aInstante(cita.fecha, cita.hora);
  const fin = new Date(inicio.getTime() + (cita.duracionMin || 30) * 60000);

  const titulo = (cita.control ? 'Control médico' : 'Cita médica') + ' · ' + doc.n;
  const lugar  = APP.clinica.nombre + ' · ' + doc.room + ' · ' + APP.clinica.direccion;

  const lineas = [
    doc.sp + ' con ' + doc.n + '.',
    'Código de la cita: ' + cita.codigo + '.',
    'Hora de ' + ZONA.etiqueta + ': ' + hora12(cita.hora) + ', ' + fechaLarga(cita.fecha) + '.',
    'Llegá 10 minutos antes y hacé el check-in con el QR de tu cita.'
  ];
  if (urlComprobante) lineas.push('Tu comprobante: ' + urlComprobante);
  lineas.push('', 'Generado por ' + APP.nombre + ' (prototipo académico).');

  return {
    uid: cita.codigo + '@mediconnect.demo',
    titulo,
    lugar,
    descripcion: lineas.join('\n'),
    inicio,
    fin,
    url: urlComprobante || null
  };
}

/* ------------------------------------------------------------
   Archivo .ics
   Las horas van en UTC (terminadas en Z). Es la forma que entienden
   todos los calendarios sin discutir: cada telefono la muestra en
   su propia zona, y en El Salvador sale exactamente la hora de la app.
   ------------------------------------------------------------ */
export function ics(cita, opciones){
  const e = eventoDeCita(cita, opciones);
  const ahora = selloIcs(new Date());

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MediConnect//Prototipo academico//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:' + ZONA.id,
    'BEGIN:VEVENT',
    'UID:' + e.uid,
    'DTSTAMP:' + ahora,
    'DTSTART:' + selloIcs(e.inicio),
    'DTEND:' + selloIcs(e.fin),
    'SUMMARY:' + escapar(e.titulo),
    'LOCATION:' + escapar(e.lugar),
    'DESCRIPTION:' + escapar(e.descripcion),
    e.url ? 'URL:' + escapar(e.url) : null,
    'STATUS:' + (cita.estado === 'cancelada' ? 'CANCELLED' : 'CONFIRMED'),
    'SEQUENCE:' + (cita.cambios || 0),
    'TRANSP:OPAQUE',
    // Aviso del propio calendario, 1 hora antes
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + escapar('Tu cita en ' + APP.nombre + ' es en una hora'),
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** Nombre de archivo limpio */
export const nombreArchivo = (cita) => 'mediconnect-' + cita.codigo.toLowerCase() + '.ics';

/**
 * Descarga el .ics. Devuelve lo que REALMENTE paso, para que la
 * interfaz no mienta: 'descargado' o 'abierto' (algunos telefonos
 * abren el archivo en vez de guardarlo).
 */
export function descargarIcs(cita, opciones){
  const texto = ics(cita, opciones);
  const blob = new Blob([texto], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(cita);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  // Si el navegador no soporta `download`, el archivo se abre en otra pestana
  return ('download' in a) ? 'descargado' : 'abierto';
}

/* ------------------------------------------------------------
   Enlace de Google Calendar (abre el formulario ya lleno;
   la persona decide si lo guarda)
   ------------------------------------------------------------ */
export function urlGoogle(cita, opciones){
  const e = eventoDeCita(cita, opciones);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: selloIcs(e.inicio) + '/' + selloIcs(e.fin),
    details: e.descripcion,
    location: e.lugar,
    ctz: ZONA.id
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/** Enlace de Outlook / Office 365 */
export function urlOutlook(cita, opciones){
  const e = eventoDeCita(cita, opciones);
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.titulo,
    startdt: e.inicio.toISOString(),
    enddt: e.fin.toISOString(),
    body: e.descripcion,
    location: e.lugar
  });
  return 'https://outlook.live.com/calendar/0/deeplink/compose?' + p.toString();
}
