/* ============================================================
   MediConnect · fechas.js
   Todo el manejo de fecha y hora pasa por aqui.

   Idea clave: una cita se guarda como "fecha + hora de pared"
   en la zona de la clinica (ej. 2026-11-25 a las 09:00 en
   El Salvador). De ahi se calcula el instante universal (UTC)
   que necesitan el archivo de calendario y el correo.

   Asi la app, el .ics y el correo muestran SIEMPRE la misma hora,
   aunque el telefono del docente este configurado en otro pais.
   ============================================================ */

import { ZONA, PARAMS } from './config.js';

export const MES   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export const MESL  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export const DABR  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
export const DLONG = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const UN_DIA = 86400000;
const dosD = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------
   Conversiones entre "hora de pared en la clinica" y UTC
   ------------------------------------------------------------ */

/** '2026-11-25' + '09:00'  ->  objeto Date con el instante real */
export function aInstante(fecha, hora){
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, min]  = hora.split(':').map(Number);
  // hora_local = UTC + desfase  =>  UTC = hora_local - desfase
  return new Date(Date.UTC(a, m - 1, d, h, min) - ZONA.desfaseMin * 60000);
}

/** Date -> { fecha:'2026-11-25', hora:'09:00' } en la zona de la clinica */
export function aPared(instante){
  const d = new Date(instante.getTime() + ZONA.desfaseMin * 60000);
  return {
    fecha: d.getUTCFullYear() + '-' + dosD(d.getUTCMonth() + 1) + '-' + dosD(d.getUTCDate()),
    hora:  dosD(d.getUTCHours()) + ':' + dosD(d.getUTCMinutes())
  };
}

/** Partes sueltas de una fecha 'YYYY-MM-DD' (sin lios de zona horaria) */
export function partes(fecha){
  const [a, m, d] = fecha.split('-').map(Number);
  const aux = new Date(Date.UTC(a, m - 1, d));
  return { anio: a, mes: m, dia: d, diaSemana: aux.getUTCDay() };
}

/* ------------------------------------------------------------
   "Hoy" segun la clinica. Se puede fingir con ?hoy=YYYY-MM-DD
   para ensayar la exposicion sin esperar al dia real.
   ------------------------------------------------------------ */
export function hoy(){
  const forzado = PARAMS.get('hoy');
  if (forzado && /^\d{4}-\d{2}-\d{2}$/.test(forzado)) return forzado;
  return aPared(new Date()).fecha;
}

/** Hora actual en la clinica, como 'HH:MM' */
export function ahoraHora(){
  return aPared(new Date()).hora;
}

/* ------------------------------------------------------------
   Aritmetica de dias (siempre sobre 'YYYY-MM-DD')
   ------------------------------------------------------------ */
export function sumarDias(fecha, n){
  const { anio, mes, dia } = partes(fecha);
  const d = new Date(Date.UTC(anio, mes - 1, dia) + n * UN_DIA);
  return d.getUTCFullYear() + '-' + dosD(d.getUTCMonth() + 1) + '-' + dosD(d.getUTCDate());
}

export function diferenciaDias(desde, hasta){
  const a = partes(desde), b = partes(hasta);
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / UN_DIA);
}

export const esFinDeSemana = (fecha) => {
  const s = partes(fecha).diaSemana;
  return s === 0 || s === 6;
};

/** Los proximos N dias habiles a partir de una fecha (incluida si es habil) */
export function diasHabiles(desde, cuantos){
  const salida = [];
  let f = desde;
  let guarda = 0;
  while (salida.length < cuantos && guarda++ < 60){
    if (!esFinDeSemana(f)) salida.push(f);
    f = sumarDias(f, 1);
  }
  return salida;
}

/* ------------------------------------------------------------
   Formatos para mostrar
   ------------------------------------------------------------ */
export const diaCorto  = (f) => DABR[partes(f).diaSemana] + ' ' + partes(f).dia;
export const diaNombre = (f) => DLONG[partes(f).diaSemana];
export const mesCorto  = (f) => MES[partes(f).mes - 1];

/** 'Miércoles 25 de noviembre' */
export function fechaLarga(fecha){
  const p = partes(fecha);
  return DLONG[p.diaSemana] + ' ' + p.dia + ' de ' + MESL[p.mes - 1];
}

/** 'Mié 25 nov' */
export function fechaMedia(fecha){
  const p = partes(fecha);
  return DABR[p.diaSemana] + ' ' + p.dia + ' ' + MES[p.mes - 1];
}

/** 'Hoy', 'Mañana' o 'Mié 25' */
export function relativa(fecha, referencia){
  const n = diferenciaDias(referencia || hoy(), fecha);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return diaCorto(fecha);
}

/** '09:00' -> '9:00 a. m.'  ·  '14:30' -> '2:30 p. m.' */
export function hora12(hora){
  const [h, m] = hora.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + dosD(m) + ' ' + sufijo;
}

/** '09:00' + 30 min -> '09:30' */
export function sumarMinutos(hora, min){
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + min;
  return dosD(Math.floor(total / 60) % 24) + ':' + dosD(total % 60);
}

/* ------------------------------------------------------------
   Formato para archivos de calendario (.ics): siempre en UTC
   20261125T150000Z
   ------------------------------------------------------------ */
export function selloIcs(instante){
  const d = instante;
  return d.getUTCFullYear() + dosD(d.getUTCMonth() + 1) + dosD(d.getUTCDate()) + 'T' +
         dosD(d.getUTCHours()) + dosD(d.getUTCMinutes()) + dosD(d.getUTCSeconds()) + 'Z';
}

/** Igual que selloIcs pero para el enlace de Google Calendar */
export const selloGoogle = selloIcs;

/* ------------------------------------------------------------
   Comparaciones utiles
   ------------------------------------------------------------ */
export function esPasado(fecha, hora){
  return aInstante(fecha, hora).getTime() < Date.now();
}

export function horasFaltantes(fecha, hora){
  return (aInstante(fecha, hora).getTime() - Date.now()) / 3600000;
}

/** Texto amable del tiempo que falta: 'en 3 días', 'en 2 horas', 'en 15 minutos' */
export function faltan(fecha, hora){
  const ms = aInstante(fecha, hora).getTime() - Date.now();
  if (ms < 0) return 'ya pasó';
  const min = Math.round(ms / 60000);
  if (min < 60) return 'en ' + min + (min === 1 ? ' minuto' : ' minutos');
  const h = Math.round(min / 60);
  if (h < 24) return 'en ' + h + (h === 1 ? ' hora' : ' horas');
  const d = Math.round(h / 24);
  return 'en ' + d + (d === 1 ? ' día' : ' días');
}
