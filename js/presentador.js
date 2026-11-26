/* ============================================================
   MediConnect · presentador.js
   El panel que se ve al lado del telefono en la exposicion.

   Vive FUERA de la app del paciente: aqui se eligen los casos
   academicos y se simulan las decisiones que en la vida real
   toman el medico, el banco o la aseguradora.

   IMPORTANTE: este panel escribe en los datos de la demo.
   Por eso cada accion comprueba primero que el panel este
   habilitado (?demo=0 lo apaga por completo). En un sistema con
   servidor, estas operaciones exigirian un rol de administrador;
   aqui se deja anotado como parte del aprendizaje.
   ============================================================ */

import { S, ir, tabear, repintar, log, avisar, limpiarTemporizadores } from './nucleo/estado.js';
import { CASOS, medicos, medico } from './nucleo/datos.js';
import { simulacion, diaBloqueado, diasVisibles, horariosLibres, proximoDiaLibre,
         citasDe, fechaControl, ESTADOS } from './nucleo/agenda.js';
import { transaccion, nuevoId, nuevoCodigo, borrarTodo, leerAjustes } from './nucleo/almacen.js';
import { hoy, fechaLarga, fechaMedia, hora12, sumarDias, esFinDeSemana, DLONG, MES, partes } from './nucleo/fechas.js';
import { usuarioActual } from './nucleo/cuenta.js';
import { pedirRecordatorio, configurado, baseN8n } from './nucleo/automatizacion.js';
import { esc } from './nucleo/ui.js';
import { PARAMS } from './nucleo/config.js';

const PANEL = document.getElementById('panel');

export const panelHabilitado = () => !document.body.classList.contains('nopanel');

/* ------------------------------------------------------------
   Utilidad: deja lista una cita de demostracion con el estado
   que necesita el caso. Escribe directo en el almacenamiento
   porque es una herramienta del presentador, no del paciente.
   ------------------------------------------------------------ */
function citaDeDemostracion({ medicoId = 'her', estado = ESTADOS.AGENDADA, control = false, enMinutos = 45 } = {}){
  const u = usuarioActual();
  const ahora = new Date(Date.now() + enMinutos * 60000);
  const pared = new Date(ahora.getTime() - 6 * 3600000);  // zona de la clinica
  const fecha = pared.toISOString().slice(0, 10);
  const hora = String(pared.getUTCHours()).padStart(2, '0') + ':' + String(pared.getUTCMinutes()).padStart(2, '0');

  const r = transaccion((datos) => {
    const cita = {
      id: nuevoId('cita'),
      codigo: nuevoCodigo(),
      usuarioId: u?.id || null,
      invitado: !u,
      medicoId, fecha, hora,
      duracionMin: 30,
      estado, control,
      motivo: { sintomas: [...S.sintomas], desde: S.sintomas.size ? S.desde : null },
      pago: { modo: 'seguro', seguroId: 'sisa', monto: 0, estado: 'cubierto' },
      claveIdem: null,
      creada: Date.now() - 120000,
      actualizada: Date.now(),
      cambios: 0,
      checkIn: estado === ESTADOS.EN_SALA || estado === ESTADOS.EN_CONSULTA ? Date.now() : null,
      demo: true,
      notificacion: { estado: 'apagado', intentos: 0, error: null, ts: null }
    };
    datos.citas.push(cita);
    return { ok: true, cita };
  });
  return r.cita;
}

function limpiarCitasDeDemo(){
  transaccion((datos) => {
    datos.citas = datos.citas.filter(c => !c.demo);
    return { ok: true };
  });
}

function baseComun(){
  limpiarTemporizadores();
  limpiarCitasDeDemo();
  S.hoja = null;
  S.esControl = false;
  S.medicoId = 'her';
  S.fecha = null;
  S.hora = null;
  S.metodoPago = 0;
  S.etapaConsulta = 'live';
  S.pasoLab = 1;
  S.hizoLab = false;
  S.turno = 2;
  S.calificacion = 0;
  S.seguimiento = 'pendiente';
  S.visitaTerminada = false;
  S.ultimoError = null;
  S.reservando = false;
  S.demo.seguro = 'vigente';
  S.demo.pago = 'ok';
  S.historial = ['inicio'];
  S.atras = false;
}

const sintomasDeEjemplo = () => { S.sintomas = new Set(['Fiebre', 'Dolor de garganta']); S.desde = '2–3 días'; };

/* ------------------------------------------------------------
   Los saltos a cada caso
   ------------------------------------------------------------ */
const SALTOS = {
  flujo(){
    baseComun();
    S.historial = [];
    S.pantalla = 'bienvenida';
    log('INICIO · recorrido completo desde la bienvenida', 'ok');
  },

  c1(){
    baseComun();
    simulacion.diaSinCupos = true;
    S.demo.sinCupos = true;
    S.fecha = diaBloqueado();
    S.hora = null;
    S.historial = ['inicio', 'agendar'];
    S.pantalla = 'medico';
    log('C1 · ¿hay horarios ese día? NO → la agenda lo rechaza');
  },

  c2(){
    baseComun();
    const cita = citaDeDemostracion({ enMinutos: 60 });
    S.citaId = cita.id;
    S.pantalla = 'cita';
    log('C2 · cita ' + cita.codigo + ' AGENDADA con pase QR · se puede hacer check-in, cambiar o cancelar');
  },

  c3(){
    baseComun();
    const f = proximoDiaLibre('her', hoy(), usuarioActual()?.id || null);
    const h = f ? horariosLibres('her', f, usuarioActual()?.id || null)[0] : null;
    S.medicoId = 'her'; S.fecha = f; S.hora = h ? h.hora : null;
    S.seguroElegido = 'sisa';
    S.historial = ['inicio', 'agendar', 'medico'];
    S.pantalla = 'confirmar';
    log('C3 · SISA vigente + el Dr. Herrera la acepta → $0');
  },

  c4(){
    baseComun();
    S.demo.seguro = 'vencido';
    const f = proximoDiaLibre('her', hoy(), usuarioActual()?.id || null);
    const h = f ? horariosLibres('her', f, usuarioActual()?.id || null)[0] : null;
    S.fecha = f; S.hora = h ? h.hora : null;
    S.historial = ['inicio', 'agendar', 'medico'];
    S.pantalla = 'confirmar';
    log('C4a · póliza MAPFRE vencida → pago directo');
  },

  c4b(){
    baseComun();
    S.demo.seguro = 'noacepta';
    S.medicoId = 'men';
    const f = proximoDiaLibre('men', hoy(), usuarioActual()?.id || null);
    const h = f ? horariosLibres('men', f, usuarioActual()?.id || null)[0] : null;
    S.fecha = f; S.hora = h ? h.hora : null;
    S.historial = ['inicio', 'agendar', 'medico', 'confirmar'];
    S.pantalla = 'pago';
    log('C4b · la Dra. Méndez no acepta SISA → pago directo $30');
  },

  c4c(){
    baseComun();
    S.demo.pago = 'fail';
    S.demo.seguro = 'vencido';
    const f = proximoDiaLibre('her', hoy(), usuarioActual()?.id || null);
    const h = f ? horariosLibres('her', f, usuarioActual()?.id || null)[0] : null;
    S.fecha = f; S.hora = h ? h.hora : null;
    S.historial = ['inicio', 'agendar', 'medico', 'confirmar'];
    S.pantalla = 'pago';
    log('C4c · el próximo cobro con tarjeta será RECHAZADO');
  },

  c5(){
    baseComun();
    if (!S.sintomas.size) sintomasDeEjemplo();
    const cita = citaDeDemostracion({ estado: ESTADOS.EN_SALA, enMinutos: 20 });
    S.citaId = cita.id;
    S.turno = 2;
    S.historial = ['cita'];
    S.pantalla = 'sala';
    log('C5 · cita ' + cita.codigo + ' EN_SALA · turno A-07');
  },

  c6(){
    baseComun();
    if (!S.sintomas.size) sintomasDeEjemplo();
    S.demo.lab = true;
    const cita = citaDeDemostracion({ estado: ESTADOS.EN_CONSULTA, enMinutos: 5 });
    S.citaId = cita.id;
    S.historial = ['cita'];
    S.pantalla = 'consulta';
    log('C6 · médico.ordenaExámenes = SÍ');
  },

  c7(){
    baseComun();
    if (!S.sintomas.size) sintomasDeEjemplo();
    S.hizoLab = true;
    S.visitaTerminada = true;
    const cita = citaDeDemostracion({ estado: ESTADOS.ATENDIDA, enMinutos: -45 });
    S.citaId = cita.id;
    S.historial = ['cita'];
    S.pantalla = 'resumen';
    log('C7 · cita ATENDIDA · diagnóstico, receta y pago en el resumen');
  },

  c8(){
    baseComun();
    S.hizoLab = true;
    S.visitaTerminada = true;
    const cita = citaDeDemostracion({ estado: ESTADOS.ATENDIDA, enMinutos: -45 });
    S.citaId = cita.id;
    S.medicoId = cita.medicoId;
    S.esControl = true;
    S.controlSugerido = fechaControl(cita);
    S.fecha = S.controlSugerido;
    S.hora = null;
    S.mesCalendario = S.controlSugerido.slice(0, 7);
    S.historial = ['resumen'];
    S.pantalla = 'control';
    log('C8 · control sugerido = cita + 7 días → el ciclo vuelve a empezar');
  }
};

/* ------------------------------------------------------------
   Dibujo del panel
   ------------------------------------------------------------ */
function segmento(clave, opciones){
  return '<div class="seg" role="group">' + opciones.map(o =>
    '<button data-p="set" data-k="' + clave + '" data-v="' + o[0] + '" ' +
    'class="' + (String(S.demo[clave]) === String(o[0]) ? 'on' : '') + '" ' +
    'aria-pressed="' + (String(S.demo[clave]) === String(o[0])) + '">' + o[1] + '</button>').join('') + '</div>';
}

export function renderPanel(){
  if (!PANEL) return;

  const hechos = S.casos;
  const n = CASOS.filter(c => hechos.has(c.id)).length;
  const h = hoy();
  const p = partes(h);
  const hoyTexto = DLONG[p.diaSemana].toLowerCase() + ' ' + p.dia + ' ' + MES[p.mes - 1] + ' ' + p.anio;
  const bloqueado = diaBloqueado();

  const avanzar = S.pantalla === 'sala' ? 'Avanzar la fila'
    : S.pantalla === 'lab' ? 'Avanzar el laboratorio'
    : (S.pantalla === 'consulta' && S.etapaConsulta === 'live') ? 'Decidir ahora'
    : null;

  const subcasos = [
    ['flujo', '▶', 'Flujo completo', 'Desde la bienvenida, camino principal'],
    ['c1', 'C1', 'Agendar sin cupos', 'La agenda rechaza el día lleno'],
    ['c2', 'C2', 'Check-in, cambio y cancelación', 'Pase QR, reprogramar o cancelar'],
    ['c3', 'C3', 'Seguro cubre $0', 'SISA vigente con el Dr. Herrera'],
    ['c4', 'C4a', 'Póliza vencida', 'MAPFRE 12-345678 vencida'],
    ['c4b', 'C4b', 'Seguro no aceptado', 'La Dra. Méndez no acepta SISA'],
    ['c4c', 'C4c', 'Pago rechazado', 'El banco rechaza la Visa •••• 4417'],
    ['c5', 'C5', 'Consulta médica', 'La fila avanza sola hasta tu turno'],
    ['c6', 'C6', 'Requiere laboratorio', 'Hemograma · LAB-1042'],
    ['c7', 'C7', 'Cierre y expediente', 'Diagnóstico, receta, pago y calificación'],
    ['c8', 'C8', 'Cita de seguimiento', 'El ciclo vuelve a empezar']
  ];

  PANEL.innerHTML =
    '<div class="row" style="gap:8px"><h2 class="grow">Panel del presentador</h2>' +
    '<span class="tagsim">Simulado</span></div>' +
    '<p class="cap mute" style="margin:-8px 0 0">Fuera de la app del paciente. Acá decide el médico y se simulan ' +
    'el banco y la aseguradora.</p>' +

    '<div><h3>Casos del curso · ' + n + ' de 8</h3>' +
    '<div class="prog"><i style="width:' + (n / 8 * 100) + '%"></i></div></div>' +

    '<div class="stack" style="gap:2px">' + subcasos.map(([salto, etiqueta, titulo, sub]) => {
      const id = etiqueta.replace(/[a-c]$/, '');
      const hecho = hechos.has(id);
      return '<button class="case' + (hecho ? ' done' : '') + '" data-p="salto" data-v="' + salto + '">' +
        '<b>' + (hecho && etiqueta !== '▶' ? '✓' : etiqueta) + '</b>' +
        '<span class="ctx"><strong>' + titulo + '</strong><span>' + sub + '</span></span></button>';
    }).join('') + '</div>' +

    '<div class="stack" style="gap:12px"><h3 style="margin:0">Decisiones y simulación</h3>' +
    '<div class="ctl"><span>El médico pide exámenes</span>' + segmento('lab', [[true, 'Sí · C6'], [false, 'No · C7']]) + '</div>' +
    '<div class="ctl"><span>Próximo pago con tarjeta</span>' + segmento('pago', [['ok', 'Aprobado'], ['fail', 'Rechazado']]) + '</div>' +
    '<div class="ctl"><span>Seguro de la próxima cita</span>' +
    segmento('seguro', [['vigente', 'Vigente'], ['vencido', 'Vencido'], ['noacepta', 'No aceptado']]) + '</div>' +
    '<div class="ctl"><span>Día sin cupos' + (bloqueado ? ' (' + fechaMedia(bloqueado) + ')' : '') + '</span>' +
    segmento('sinCupos', [[true, 'Activado'], [false, 'Desactivado']]) + '</div>' +

    '<div class="row" style="gap:6px;flex-wrap:wrap">' +
    '<button class="pbtn" data-p="sintomas">' + (S.sintomas.size ? 'Vaciar síntomas' : 'Cargar síntomas de ejemplo') + '</button>' +
    (avanzar ? '<button class="pbtn primary" data-p="avanzar">' + avanzar + '</button>' : '') +
    '<button class="pbtn" data-p="reiniciar">Reiniciar recorrido</button>' +
    '</div>' +

    '<label class="hoy">Hoy: <strong>' + hoyTexto + '</strong>' +
    '<input type="date" value="' + h + '" data-p="hoy" aria-label="Cambiar la fecha de hoy"></label>' +
    '</div>' +

    // --- automatizaciones ---
    '<div class="stack" style="gap:10px"><h3 style="margin:0">Automatización (n8n)</h3>' +
    '<span class="pestado ' + (configurado() ? 'ok' : 'gris') + '">' +
    (configurado() ? 'Conectado' : 'Sin configurar') + '</span>' +
    (configurado()
      ? '<p class="pnota" style="word-break:break-all">' + esc(baseN8n()) + '</p>'
      : '<p class="pnota">Se configura dentro de la app, en Perfil → Ajustes de la demo, o agregando ' +
        '<code>?n8n=https://…</code> a la dirección.</p>') +
    '<div class="row" style="gap:6px;flex-wrap:wrap">' +
    '<button class="pbtn" data-p="recordatorio"' + (configurado() ? '' : ' disabled') + '>' +
    'Probar recordatorio (' + leerAjustes().recordatorioMinutos + ' min)</button>' +
    '</div></div>' +

    // --- bitacora ---
    '<div><h3>Registro de la lógica</h3><div class="log" id="plog">' +
    (S.bitacora.length
      ? S.bitacora.slice(-16).map(l =>
          '<em>' + l.hora + '</em> ' + (l.tipo === 'ok' ? '<b>' : l.tipo === 'err' ? '<i>' : '') +
          esc(l.texto) + (l.tipo === 'ok' ? '</b>' : l.tipo === 'err' ? '</i>' : '')).join('\n')
      : '<em>—</em> Elegí un caso o tocá la app.') +
    '</div></div>' +

    '<p class="pnota">Este panel escribe en los datos de la demo. En un sistema con servidor haría falta ' +
    'un rol de administrador: esconderlo no bastaría.</p>';

  const l = document.getElementById('plog');
  if (l) l.scrollTop = l.scrollHeight;
}

/* ------------------------------------------------------------
   Eventos del panel
   ------------------------------------------------------------ */
export function conectarPanel(avanzarVisita){
  if (!PANEL) return;

  PANEL.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-p]');
    if (!t || t.disabled) return;
    if (!panelHabilitado()) return;            // el panel apagado no escribe nada

    const a = t.dataset.p;
    const v = t.dataset.v;

    if (a === 'salto'){
      SALTOS[v]();
      document.body.classList.remove('open');
      ir(S.pantalla, { reemplazar: true });
      return;
    }

    if (a === 'set'){
      const k = t.dataset.k;
      S.demo[k] = v === 'true' ? true : v === 'false' ? false : v;
      if (k === 'sinCupos') simulacion.diaSinCupos = S.demo.sinCupos;
      log('simulación · ' + k + ' = ' + v);
      repintar();
      return;
    }

    if (a === 'sintomas'){
      if (S.sintomas.size){ S.sintomas = new Set(); log('motivo = [] (sin síntomas)'); }
      else { sintomasDeEjemplo(); log('motivo = [Fiebre, Dolor de garganta] · 2–3 días'); }
      repintar();
      return;
    }

    if (a === 'avanzar'){ avanzarVisita(); return; }

    if (a === 'reiniciar'){
      SALTOS.flujo();
      S.casos = new Set();
      S.bitacora = [];
      ir('bienvenida', { reemplazar: true });
      return;
    }

    if (a === 'recordatorio'){
      const cita = citasDe(usuarioActual()?.id || null)
        .filter(c => c.estado === ESTADOS.AGENDADA)[0];
      if (!cita){ avisar('Primero agendá una cita', 'err'); return; }
      log('n8n · pidiendo recordatorio para ' + cita.codigo + '…');
      const r = await pedirRecordatorio(cita, usuarioActual()?.perfil, leerAjustes().recordatorioMinutos);
      log('n8n · recordatorio -> ' + (r.ok ? 'programado' : (r.detalle || r.estado)), r.ok ? 'ok' : 'err');
      avisar(r.ok ? 'Recordatorio programado en n8n' : 'No se pudo programar el recordatorio', r.ok ? 'ok' : 'err');
      repintar();
    }
  });

  PANEL.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.p === 'hoy' && t.value){
      const q = new URLSearchParams(location.search);
      q.set('hoy', t.value);
      location.search = q.toString();
    }
  });

  const fab = document.getElementById('pfab');
  const scrim = document.getElementById('pscrim');
  if (fab) fab.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('open');
    fab.setAttribute('aria-expanded', String(abierto));
  });
  if (scrim) scrim.addEventListener('click', () => {
    document.body.classList.remove('open');
    if (fab) fab.setAttribute('aria-expanded', 'false');
  });
}
