/* ============================================================
   MediConnect · pantallas/visita.js
   Lo que pasa el dia de la cita: sala de espera, consulta,
   laboratorio y resumen.

   Esta parte es una SIMULACION academica: aqui no hay un medico
   real escribiendo. Lo que si es real es la maquina de estados
   de la cita (en sala -> en consulta -> atendida) y el paso al
   control, que vuelve a empezar el ciclo.
   ============================================================ */

import { ic, esc, cara, manchas, accion, encabezado, boton, interruptor, simulado } from '../nucleo/ui.js';
import { S, ir, tabear, avisar, repintar, log, marcarCaso, programar,
         limpiarTemporizadores, hayTemporizadores, usuario } from '../nucleo/estado.js';
import { medico, NombreCon, nombreCon, nombreCortoSeguro } from '../nucleo/datos.js';
import { citaPorId, cambiarEstado, fechaControl, ESTADOS } from '../nucleo/agenda.js';
import { fechaLarga, hora12 } from '../nucleo/fechas.js';

export const vistas = {};

const AVANCE_MS = 6000;
const citaActual = () => (S.citaId ? citaPorId(S.citaId) : null);

/* ------------------------------------------------------------
   Sala de espera
   ------------------------------------------------------------ */
vistas.sala = () => {
  const cita = citaActual();
  if (!cita) return { nav: 'citas', titulo: 'Sala', html: '<div class="screen"><div class="stack">' + boton('Ver mis citas', 'tabCitas') + '</div></div>' };
  const d = medico(cita.medicoId);
  const listo = S.turno <= 0;
  const fila = listo ? [['Vos', 1]] : S.turno === 1 ? [['A-06'], ['Vos', 1]] : [['A-05'], ['A-06'], ['Vos', 1]];

  return {
    nav: 'citas',
    titulo: 'Sala de espera',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button>' +
      '<div class="grow"></div>' + simulado('Fila simulada') + '</div>' +
      encabezado('Sala de espera', listo ? '¡Es tu turno!' : 'Ya casi es<br>tu turno') +

      '<div class="card dark" style="padding:24px;gap:6px;border-radius:32px">' +
      manchas([['#2F4BF0', 280, 120, -120], ['#8FA4FF', 120, 230, -10, .7]]) +
      '<span class="content body dim">Tu número</span>' +
      '<span class="content num">A-07</span>' +
      '<span class="content body" style="opacity:.86">' +
      (listo ? 'Pasá al ' + esc(d.room)
             : S.turno + (S.turno === 1 ? ' persona' : ' personas') + ' antes que vos · unos ' + Math.round(S.turno * 7.5) + ' min') +
      '</span>' +
      '<div class="content row" style="gap:6px;padding-top:12px">' +
      fila.map(x => '<span class="pill" style="' + (x[1] ? 'background:#fff;color:var(--ink)' : 'background:rgba(255,255,255,.14);color:#fff') + '">' +
        x[0] + '</span>').join('') + '</div></div>' +

      '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s44 bsoft">' + ic('bell') + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="ct">Te avisamos al celular</span>' +
      '<span class="cap mute">Esperá donde querás</span></div>' +
      interruptor(S.avisarTurno, 'avisarTurno', undefined, 'Avisarme cuando sea mi turno') + '</div>' +

      '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s44 field">' + ic('pin') + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="ct">' + esc(d.room) + '</span>' +
      '<span class="cap mute">' + esc(d.n) + '</span></div></div>' +

      '</div></div>' +
      (listo ? accion('Entrar a consulta', 'entrarConsulta') : '')
  };
};

/* ------------------------------------------------------------
   Consulta
   ------------------------------------------------------------ */
vistas.consulta = () => {
  const cita = citaActual();
  if (!cita) return vistas.sala();
  const d = medico(cita.medicoId);
  const etapa = S.etapaConsulta;
  const sintomas = cita.motivo?.sintomas || [];
  const sinSintomas = sintomas.length === 0;
  const seguro = cita.pago?.seguroId ? nombreCortoSeguro(cita.pago.seguroId) : null;

  const titulo = etapa === 'exam'
    ? encabezado('En consulta', NombreCon(d) + '<br>te ordenó un examen')
    : etapa === 'done'
      ? encabezado('Consulta terminada', 'Listo, tu consulta<br>terminó')
      : encabezado('En consulta', NombreCon(d) + '<br>ya te está atendiendo');

  const pastillaPago = seguro
    ? '<span class="pill sm okp">' + ic('shield', 14) + 'Cubierto por ' + esc(seguro) + '</span>'
    : '<span class="pill sm" style="background:#fff;color:var(--ink)">' +
      (cita.pago?.modo === 'clinica' ? 'Pago en caja · $' + d.price : 'Pago directo · $' + d.price) + '</span>';

  const puntos = etapa === 'done'
    ? ['Tu receta ya está en la farmacia']
        .concat(S.hizoLab ? ['Tu hemograma llega a tu expediente'] : [])
        .concat(['Control sugerido: ' + fechaLarga(fechaControl(cita)).toLowerCase()])
    : [sinSintomas ? 'Tu motivo: control general' : 'Tus síntomas de hoy',
       'Tu expediente completo',
       seguro ? 'Tu cobertura ' + seguro + ' validada' : 'Tu pago de $' + d.price + ' confirmado'];

  const pie = etapa === 'exam'
    ? '<div class="card soft" style="gap:8px"><div class="row" style="gap:10px">' +
      '<span style="color:var(--brand)">' + ic('flask', 20) + '</span><span class="ct">Hemograma completo</span></div>' +
      '<span class="body mute">La orden LAB-1042 ya la tiene el laboratorio, en planta baja al lado de la farmacia. No necesitás ayuno.</span></div>'
    : etapa === 'done'
      ? ''
      : '<div class="card soft" style="gap:8px"><div class="row" style="gap:10px">' +
        '<span style="color:var(--brand)">' + ic('flask', 20) + '</span><span class="ct">¿Te piden exámenes?</span></div>' +
        '<span class="body mute">Los ordenamos aquí mismo y te avisamos cuando estén listos. No tenés que volver por papeles.</span></div>';

  return {
    nav: 'citas',
    titulo: 'En consulta',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><div class="grow"></div>' + simulado('Consulta simulada') + '</div>' +
      titulo +

      '<div class="card dark" style="padding:22px;gap:16px;border-radius:32px">' +
      manchas([['#2F4BF0', 240, 160, -110]]) +
      '<div class="content row">' + cara(d.f, 52) +
      '<div class="grow stack" style="gap:2px"><span class="ct">' + esc(d.n) + '</span>' +
      '<span class="cap dim">' + esc(d.room) + '</span></div>' +
      (etapa === 'done' ? '<span class="pill sm brandp">Terminada</span>' : '<span class="live">En vivo</span>') + '</div>' +
      '<div class="content stack" style="gap:4px"><span class="cap dim">Tu motivo</span>' +
      '<span class="body">' + (sinSintomas
        ? 'Sin síntomas registrados · control general'
        : esc(sintomas.join(', ')) + (cita.motivo.desde ? ' · desde hace ' + esc(cita.motivo.desde) : '')) + '</span></div>' +
      '<div class="content">' + pastillaPago + '</div></div>' +

      '<div class="card" style="gap:14px">' +
      '<span class="ct">' + (etapa === 'done' ? 'Lo que sigue' : 'Tu médico ya tiene') + '</span>' +
      puntos.map(t => '<div class="row" style="gap:10px"><span class="cb s28 ok">' + ic('check', 16) + '</span>' +
        '<span class="body">' + esc(t) + '</span></div>').join('') + '</div>' +

      pie + '</div></div>' +
      (etapa === 'exam' ? accion('Ir al laboratorio', 'irLab')
                        : etapa === 'done' ? accion('Ver resumen', 'irResumen') : '')
  };
};

/* ------------------------------------------------------------
   Laboratorio
   ------------------------------------------------------------ */
vistas.lab = () => {
  const paso = S.pasoLab;
  const pasos = [
    ['check', 'Orden lista', 'LAB-1042 · ya la tiene el laboratorio'],
    ['flask', 'Toma de muestra', 'Planta baja · turno L-03 · unos 5 min'],
    ['file', 'Resultado en tu expediente', paso >= 3 ? 'Listo · revisado por tu médico' : 'Te avisamos en unas 2 horas']
  ];

  return {
    nav: 'citas',
    titulo: 'Laboratorio',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button>' +
      '<div class="grow"></div>' + simulado('Laboratorio simulado') + '</div>' +
      encabezado('Laboratorio', 'Hemograma<br>completo') +

      '<div class="card" style="gap:0">' + pasos.map((s, i) => {
        const hecho = paso > i, ahora = paso === i;
        return (i ? '<div class="conn' + (paso >= i ? ' on' : '') + '"></div>' : '') +
          '<div class="step"><span class="cb s36 ' + (hecho ? 'brand' : ahora ? 'bsoft' : '') + '"' +
          (!hecho && !ahora ? ' style="color:var(--ink2)"' : '') + '>' + ic(hecho ? 'check' : s[0], 18) + '</span>' +
          '<div class="grow stack" style="gap:2px;padding-top:2px">' +
          '<span class="bm' + (!hecho && !ahora ? ' mute' : '') + '">' + s[1] + '</span>' +
          '<span class="cap mute">' + s[2] + '</span></div>' +
          (ahora ? '<span class="pill sm brandp">Ahora</span>' : '') + '</div>';
      }).join('') + '</div>' +

      '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s44 field">' + ic('pin') + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="ct">Laboratorio · planta baja</span>' +
      '<span class="cap mute">Al lado de la farmacia</span></div></div>' +

      '<div class="card dark" style="gap:6px">' + manchas([['#3B5BF6', 200, 190, -60, .9]]) +
      '<span class="content ct">Sin papeles</span>' +
      '<span class="content body dim">Tu resultado llega directo a tu expediente y tu médico lo revisa.</span></div>' +

      '</div></div>' +
      (paso >= 3 ? accion('Volver a la consulta', 'volverDeLab') : '')
  };
};

/* ------------------------------------------------------------
   Resumen de la consulta
   ------------------------------------------------------------ */
vistas.resumen = () => {
  const cita = citaActual();
  const d = cita ? medico(cita.medicoId) : medico(S.medicoId);
  const seguro = cita?.pago?.seguroId ? nombreCortoSeguro(cita.pago.seguroId) : null;
  const textoPago = cita?.pago?.modo === 'clinica' ? 'Pendiente · pagás en caja'
    : seguro ? 'Cubierto por ' + seguro
    : 'Pagado · $' + d.price + ' con Visa';

  const mosaicos = [
    ['activity', 'Diagnóstico', 'Faringitis aguda', 'bsoft'],
    ['pill', 'Receta', 'Enviada a farmacia', 'ok'],
    ['flask', 'Laboratorio', S.hizoLab ? 'Hemograma listo' : 'No fue necesario', 'warn'],
    [seguro ? 'shield' : 'check', 'Pago', textoPago, 'field']
  ];

  const sugerida = cita ? fechaControl(cita) : null;

  return {
    nav: 'citas',
    titulo: 'Resumen de la consulta',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><div class="grow"></div>' + simulado('Diagnóstico y receta simulados') + '</div>' +
      encabezado('Consulta terminada', 'Todo quedó en<br>tu expediente') +

      [0, 1].map(r => '<div class="row" style="gap:12px;align-items:stretch">' +
        mosaicos.slice(r * 2, r * 2 + 2).map(t =>
          '<div class="tile"><span class="cb s36 ' + t[3] + '">' + ic(t[0], 18) + '</span>' +
          '<span style="height:8px"></span><span class="cap mute">' + t[1] + '</span>' +
          '<span class="label">' + esc(t[2]) + '</span></div>').join('') + '</div>').join('') +

      '<div class="card" style="gap:14px">' +
      '<div class="row"><span class="cb s44 ok">' + ic('pill') + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="ct">Ibuprofeno 400 mg</span>' +
      '<span class="cap mute">1 pastilla cada 8 horas, por 3 días</span></div></div>' +
      '<div class="sep"></div>' +
      '<button class="row tap" data-act="verFarmacias" style="gap:10px;text-align:left">' +
      '<span class="mute">' + ic('pin', 18) + '</span>' +
      '<span class="label grow">Retirala en Farmacias San Nicolás, Escalón</span>' +
      '<span class="mute">' + ic('chev', 18) + '</span></button></div>' +

      (S.seguimiento === 'pendiente' && sugerida
        ? '<div class="card soft" style="gap:12px"><span class="ct">Control en una semana</span>' +
          '<span class="body mute">' + NombreCon(d) + ' te sugiere volver el ' +
          esc(fechaLarga(sugerida).toLowerCase()) + '. Podés elegir otra fecha.</span>' +
          '<div class="row" style="gap:8px">' +
          '<button class="pill h44 darkp tap" data-act="seguimiento" data-v="si">Elegir fecha</button>' +
          '<button class="pill h44 white tap" data-act="seguimiento" data-v="no">Ahora no</button></div></div>'
        : '') +

      '<div class="card" style="gap:14px">' +
      '<span class="ct">' + (S.calificacion ? '¡Gracias por contarnos!' : '¿Qué tal te atendieron?') + '</span>' +
      '<div class="stars" role="group" aria-label="Calificá la atención">' +
      [1, 2, 3, 4, 5].map(n => '<button class="tap' + (S.calificacion >= n ? ' on' : '') + '" ' +
        'data-act="calificar" data-v="' + n + '" aria-label="' + n + ' de 5 estrellas" ' +
        'aria-pressed="' + (S.calificacion >= n) + '">' + ic('star', 22) + '</button>').join('') + '</div></div>' +

      boton('Ver mis citas', 'tabCitas', { clase: 'white' }) +
      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Avance automatico de la fila, la consulta y el laboratorio
   ------------------------------------------------------------ */
export function programarAvances(){
  if (hayTemporizadores()) return;

  if (S.pantalla === 'sala' && S.turno > 0){
    programar(() => {
      S.turno--;
      log('fila.avanzar() → quedan ' + S.turno + ' antes que vos');
      if (S.turno === 0 && S.avisarTurno) avisar('Te toca: pasá al consultorio', 'ok');
      repintar();
      programarAvances();
    }, AVANCE_MS / 2);
  }

  if (S.pantalla === 'sala' && S.turno <= 0){
    programar(() => acciones.entrarConsulta(), 2400);
  }

  if (S.pantalla === 'consulta' && S.etapaConsulta === 'live'){
    programar(() => decidirConsulta(), AVANCE_MS);
  }

  if (S.pantalla === 'lab' && S.pasoLab < 3){
    programar(() => {
      S.pasoLab++;
      log('laboratorio.paso = ' + S.pasoLab);
      if (S.pasoLab === 3) avisar('Tu resultado ya está en tu expediente', 'ok');
      repintar();
      programarAvances();
    }, AVANCE_MS / 3);
  }

  if (S.pantalla === 'lab' && S.pasoLab >= 3){
    programar(() => acciones.volverDeLab(), 2200);
  }
}

export function decidirConsulta(){
  if (S.pantalla !== 'consulta' || S.etapaConsulta !== 'live') return;
  limpiarTemporizadores();
  if (S.demo.lab){
    S.etapaConsulta = 'exam';
    marcarCaso('C6');
    log('médico.ordenaExámenes = SÍ → caso C6');
    avisar('Tu médico te ordenó un examen');
  } else {
    S.etapaConsulta = 'done';
    log('médico.ordenaExámenes = NO → caso C7');
  }
  repintar();
}

/* ------------------------------------------------------------
   Acciones
   ------------------------------------------------------------ */
export const acciones = {
  avisarTurno(){ S.avisarTurno = !S.avisarTurno; repintar(); },

  entrarConsulta(){
    const u = usuario();
    const cita = citaActual();
    if (!cita) return;
    cambiarEstado({ citaId: cita.id, estado: ESTADOS.EN_CONSULTA, usuarioId: u?.id || null });
    marcarCaso('C5');
    log('cita ' + cita.codigo + ' → EN_CONSULTA', 'ok');
    S.etapaConsulta = 'live';
    S.hizoLab = false;
    ir('consulta');
  },

  irLab(){
    marcarCaso('C6');
    log('laboratorio.orden = LAB-1042');
    S.pasoLab = 1;
    S.hizoLab = true;
    ir('lab');
  },

  volverDeLab(){
    S.etapaConsulta = 'done';
    ir('consulta', { reemplazar: true });
  },

  irResumen(){
    const u = usuario();
    const cita = citaActual();
    if (cita){
      cambiarEstado({ citaId: cita.id, estado: ESTADOS.ATENDIDA, usuarioId: u?.id || null });
      log('cita ' + cita.codigo + ' → ATENDIDA · expediente actualizado', 'ok');
    }
    marcarCaso('C7');
    S.visitaTerminada = true;
    S.seguimiento = 'pendiente';
    S.calificacion = 0;
    ir('resumen');
  },

  calificar(v){ S.calificacion = +v; log('calificación = ' + v + '/5'); repintar(); },

  seguimiento(v){
    const cita = citaActual();
    if (v === 'si' && cita){
      const sugerida = fechaControl(cita);
      S.medicoId = cita.medicoId;
      S.esControl = true;
      S.controlSugerido = sugerida;
      S.fecha = sugerida;
      S.hora = null;
      S.mesCalendario = sugerida.slice(0, 7);
      log('control sugerido = cita + 7 días → abrir calendario');
      ir('control');
    } else {
      S.seguimiento = 'no';
      log('¿agenda control? NO → vuelve a Inicio');
      tabear('inicio');
    }
  },

  verFarmacias(){ S.pestanaExpediente = 'Farmacias'; tabear('expediente'); }
};
