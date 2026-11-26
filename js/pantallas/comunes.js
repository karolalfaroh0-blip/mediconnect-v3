/* ============================================================
   MediConnect · pantallas/comunes.js
   Bloques que aparecen en varias pantallas: la cabecera del medico,
   el selector de dias, la rejilla de horarios y las tarjetas de cita.
   ============================================================ */

import { ic, esc, cara, boton, interruptor, simulado } from '../nucleo/ui.js';
import { medico, nombreCon, NombreCon, aseguradora, nombreCortoSeguro } from '../nucleo/datos.js';
import { horariosDe, diasVisibles, proximoDiaLibre, horariosLibres, ESTADOS } from '../nucleo/agenda.js';
import { fechaLarga, fechaMedia, hora12, relativa, diaCorto, partes, DABR, MES, faltan } from '../nucleo/fechas.js';
import { textoEnvio } from '../nucleo/automatizacion.js';
import { APP } from '../nucleo/config.js';

/* ------------------------------------------------------------
   Cabecera de la ficha del medico
   ------------------------------------------------------------ */
export function cabeceraMedico(d, { seguroPrincipal, comoTitulo = true } = {}){
  const cubre = seguroPrincipal && seguroPrincipal.vigente && d.nets.includes(seguroPrincipal.id);
  // Solo una pantalla puede tener un <h1>. En las que ya tienen encabezado
  // propio (reprogramar, control), el nombre del médico va como subtítulo.
  const et = comoTitulo ? 'h1' : 'p';
  return '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button>' +
    '<div class="grow"></div>' +
    '<button class="cb tap" data-act="llamar" data-v="' + esc(d.phone) + '" aria-label="Llamar al consultorio">' + ic('phone') + '</button></div>' +

    '<div class="row" style="gap:16px">' + cara(d.f, 76) +
    '<div class="grow stack" style="gap:4px">' +
    '<span class="body mute">' + esc(d.sp) + '</span>' +
    '<' + et + ' class="title" style="margin:0;font-weight:400">' + esc(d.n) + '</' + et + '>' +
    '<span class="row" style="gap:4px"><span style="color:var(--star)">' + ic('star', 14) + '</span>' +
    '<span class="label">' + d.rate + '</span>' +
    '<span class="cap mute">· ' + d.revs + ' reseñas · ' + d.yrs + ' años</span></span></div></div>' +

    '<div class="row" style="gap:8px;flex-wrap:wrap">' +
    (cubre ? '<span class="pill okp">' + ic('shield', 16) + 'Cubre ' + esc(nombreCortoSeguro(seguroPrincipal.id)) + '</span>' : '') +
    '<span class="pill white">' + ic('pin', 16) + esc(d.place) + '</span>' +
    '<span class="pill white">$' + d.price + ' consulta</span></div>';
}

/* ------------------------------------------------------------
   Selector rapido de dias (los proximos habiles)
   Marca con opacidad los dias que ya no tienen cupo.
   ------------------------------------------------------------ */
export function selectorDias(medicoId, fechaSel, act, usuarioId, fechas){
  const lista = fechas || diasVisibles();
  return '<div class="row" style="gap:8px" role="group" aria-label="Elegí el día">' + lista.map(f => {
    const p = partes(f);
    const libres = horariosLibres(medicoId, f, usuarioId).length;
    const sel = f === fechaSel;
    return '<button class="day tap' + (sel ? ' on' : '') + (libres ? '' : ' lleno') + '" data-act="' + act + '" data-v="' + f + '"' +
      ' aria-pressed="' + sel + '"' +
      ' aria-label="' + fechaLarga(f) + (libres ? ', ' + libres + ' horarios libres' : ', sin cupos') + '">' +
      '<span class="cap' + (sel ? '' : ' mute') + '">' + DABR[p.diaSemana] + '</span>' +
      '<span class="ct">' + p.dia + '</span></button>';
  }).join('') + '</div>';
}

/* ------------------------------------------------------------
   Rejilla de horarios de un dia
   ------------------------------------------------------------ */
export function rejillaHorarios(medicoId, fecha, horaSel, act, { usuarioId, horaActual } = {}){
  const lista = horariosDe(medicoId, fecha, usuarioId).filter(h => h.estado !== 'fuera');
  if (!lista.length) return '<p class="body mute">Este médico no atiende ese día.</p>';

  const filas = [];
  for (let i = 0; i < lista.length; i += 3) filas.push(lista.slice(i, i + 3));

  return filas.map(fila => '<div class="row" style="gap:8px">' + fila.map(h => {
    const esActual = horaActual === h.hora;
    const libre = h.estado === 'libre';
    const clase = esActual ? ' cur' : h.estado === 'mia' ? ' mia' : !libre ? ' off' : (horaSel === h.hora ? ' on' : '');
    const etiqueta = hora12(h.hora) +
      (esActual ? ', tu horario actual' : h.estado === 'mia' ? ', ya tenés una cita' :
       h.estado === 'pasado' ? ', ya pasó' : !libre ? ', ocupado' : '');
    return '<button class="slot tap' + clase + '" data-act="' + act + '" data-v="' + h.hora + '"' +
      (libre ? '' : ' aria-disabled="true"') +
      ' aria-pressed="' + (horaSel === h.hora) + '" aria-label="' + esc(etiqueta) + '">' +
      hora12(h.hora) + '</button>';
  }).join('') +
  // Rellena la fila para que las pastillas no se estiren
  Array.from({ length: 3 - fila.length }, () => '<span style="flex:1"></span>').join('') +
  '</div>').join('');
}

/* ------------------------------------------------------------
   Mensaje cuando el dia elegido ya no tiene cupos (caso C1)
   ------------------------------------------------------------ */
export function diaSinCupos(d, fecha, usuarioId){
  const siguiente = proximoDiaLibre(d.id, fecha, usuarioId);
  const libre = siguiente ? horariosLibres(d.id, siguiente, usuarioId)[0] : null;
  return '<div class="stack" role="alert" style="gap:8px;align-items:center;text-align:center;padding:8px 6px 4px">' +
    '<span class="cb s44 field">' + ic('calendar', 18) + '</span>' +
    '<span class="bm">No quedan horarios el ' + fechaLarga(fecha).toLowerCase() + '</span>' +
    '<span class="cap mute">' + NombreCon(d) + ' tiene la agenda llena ese día.' +
    (siguiente && libre
      ? ' Su próximo horario libre es el ' + fechaLarga(siguiente).toLowerCase() + ' a las ' + hora12(libre.hora) + '.'
      : ' No encontramos cupos en los próximos días.') + '</span>' +
    (siguiente && libre
      ? '<div style="width:100%;padding-top:8px">' +
        boton('Ir al ' + fechaMedia(siguiente) + ', ' + hora12(libre.hora), 'irAHueco',
              { valor: siguiente + '|' + libre.hora, clase:'darkp' }) + '</div>'
      : '') +
    '<div style="width:100%">' + boton('Ver otro médico', 'irAgendar', { clase:'fieldbg' }) + '</div>' +
    '</div>';
}

/* ------------------------------------------------------------
   Fila compacta del medico con el precio (pantallas de pago)
   ------------------------------------------------------------ */
export const filaMedico = (d, cuando) =>
  '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' + cara(d.f, 44) +
  '<div class="grow stack" style="gap:2px"><span class="bm">' + esc(d.n) + '</span>' +
  '<span class="cap mute">' + esc(cuando) + '</span></div>' +
  '<span class="title">$' + d.price + '.00</span></div>';

/* ------------------------------------------------------------
   Estado real del envio del correo de la cita
   ------------------------------------------------------------ */
export function insigniaEnvio(cita){
  const t = textoEnvio(cita.notificacion);
  const icono = t.clase === 'enviado' ? 'check'
    : t.clase === 'enviando' ? 'refresh'
    : t.clase === 'fallo' ? 'alert'
    : t.clase === 'apagado' ? 'info' : 'clock';
  return '<span class="envio ' + t.clase + '">' + ic(icono, 14) + esc(t.texto) + '</span>';
}

/* ------------------------------------------------------------
   Pastilla con el estado de la cita
   ------------------------------------------------------------ */
export function pastillaEstado(cita){
  const mapa = {
    [ESTADOS.AGENDADA]:    ['bsoftp', 'Agendada'],
    [ESTADOS.EN_SALA]:     ['warnp',  'En sala de espera'],
    [ESTADOS.EN_CONSULTA]: ['warnp',  'En consulta'],
    [ESTADOS.ATENDIDA]:    ['okp',    'Atendida'],
    [ESTADOS.CANCELADA]:   ['dangerp','Cancelada']
  };
  const [clase, texto] = mapa[cita.estado] || ['fieldbg', cita.estado];
  return '<span class="pill sm ' + clase + '">' + esc(texto) + '</span>';
}

/* ------------------------------------------------------------
   Tarjeta de una cita en la lista
   ------------------------------------------------------------ */
export function tarjetaCita(cita, { compacta = false } = {}){
  const d = medico(cita.medicoId);
  const cancelada = cita.estado === ESTADOS.CANCELADA;
  const atendida = cita.estado === ESTADOS.ATENDIDA;
  const apagada = cancelada || atendida;

  return '<button class="card tap" data-act="verCita" data-v="' + cita.id + '" style="gap:14px;text-align:left' +
    (apagada ? ';opacity:.72' : '') + '">' +
    '<div class="row" style="gap:8px">' +
    '<span class="ct">' + (cita.control ? 'Control' : 'Consulta') + ' · ' + esc(d.sp) + '</span>' +
    '<span class="grow"></span>' + pastillaEstado(cita) + '</div>' +

    '<div class="title">' + (cancelada ? '<s>' : '') + fechaMedia(cita.fecha) + ' · ' + hora12(cita.hora) +
    (cancelada ? '</s>' : '') + '</div>' +

    '<div class="row" style="gap:10px">' + cara(d.f, 28) +
    '<span class="body mute grow">' + esc(d.n) + '</span>' +
    (!apagada ? '<span class="cap mute">' + esc(faltan(cita.fecha, cita.hora)) + '</span>' : '') + '</div>' +

    (compacta || apagada ? '' : '<div class="row" style="gap:8px;flex-wrap:wrap">' + insigniaEnvio(cita) +
      '<span class="pill sm fieldbg">' + ic('qr', 13) + esc(cita.codigo) + '</span></div>') +
    '</button>';
}

/* ------------------------------------------------------------
   Resumen de los datos de la cita (confirmacion y detalle)
   ------------------------------------------------------------ */
export function detalleCita(cita){
  const d = medico(cita.medicoId);
  return '<div class="card" style="gap:14px">' +
    '<div class="row">' + cara(d.f, 48) +
    '<div class="grow stack" style="gap:2px"><span class="ct">' + esc(d.n) + '</span>' +
    '<span class="cap mute">' + esc(d.sp) + '</span></div></div>' +
    '<div class="sep"></div>' +
    [['calendar', fechaLarga(cita.fecha)],
     ['clock', hora12(cita.hora) + ' · ' + cita.duracionMin + ' min'],
     ['pin', APP.clinica.nombre + ' · ' + d.room]
    ].map(x => '<div class="row" style="gap:10px"><span class="mute">' + ic(x[0], 18) + '</span>' +
      '<span class="body">' + esc(x[1]) + '</span></div>').join('') +
    '</div>';
}

export { medico, nombreCon, NombreCon, aseguradora, nombreCortoSeguro, simulado, interruptor, relativa, diaCorto, MES };
