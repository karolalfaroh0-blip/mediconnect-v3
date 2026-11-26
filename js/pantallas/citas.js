/* ============================================================
   MediConnect · pantallas/citas.js
   Mis citas, el detalle de una cita con su QR, reprogramar y cancelar.
   ============================================================ */

import { ic, esc, cara, manchas, accion, encabezado, boton, vacio,
         aviso as avisoCaja, simulado } from '../nucleo/ui.js';
import { S, ir, tabear, abrirHoja, cerrarHoja, avisar, repintar, log,
         marcarCaso, usuario, perfil } from '../nucleo/estado.js';
import { medico, nombreCon, NombreCon } from '../nucleo/datos.js';
import { citasDe, citaPorId, proximaCita, reprogramar, cancelar, checkIn,
         horariosLibres, diasVisibles, diaLleno, ESTADOS, ESTADO_ACTIVO } from '../nucleo/agenda.js';
import { fechaLarga, fechaMedia, hora12, faltan, horasFaltantes, esPasado, relativa } from '../nucleo/fechas.js';
import { svg as qrSvg } from '../nucleo/qr.js';
import { urlComprobante, avisarCambio, avisarCancelacion, avisarReserva, configurado } from '../nucleo/automatizacion.js';
import { REGLAS, APP } from '../nucleo/config.js';
import { cabeceraMedico, selectorDias, rejillaHorarios, diaSinCupos,
         detalleCita, insigniaEnvio, pastillaEstado, tarjetaCita } from './comunes.js';

export const vistas = {};

const citaActual = () => (S.citaId ? citaPorId(S.citaId) : null);

/* ------------------------------------------------------------
   Pestana "Citas": las citas de esta cuenta
   ------------------------------------------------------------ */
vistas.citas = () => {
  const u = usuario();
  const todas = citasDe(u?.id || null);
  const activas = todas.filter(c => ESTADO_ACTIVO.includes(c.estado) && !esPasado(c.fecha, c.hora));
  const pasadas = todas.filter(c => !activas.includes(c)).reverse();

  return {
    nav: 'citas',
    titulo: 'Mis citas',
    html:
      '<div class="screen"><div class="stack gap24">' +
      encabezado('Tus citas', activas.length ? 'Lo que viene' : 'Todavía no<br>tenés citas') +

      (activas.length
        ? '<div class="stack" style="gap:12px">' + activas.map(c => tarjetaCita(c)).join('') + '</div>'
        : vacio('Sin citas próximas',
                u ? 'Agendá con el médico que necesités: te mostramos solo los horarios libres.'
                  : 'Podés agendar como invitado y crear tu cuenta después.',
                'Agendar una cita', 'irAgendar')) +

      (activas.length
        ? boton('Agendar otra cita', 'irAgendar', { clase: 'white', icono: 'plus' })
        : '') +

      (pasadas.length
        ? '<div class="stack" style="gap:12px"><span class="ct">Anteriores</span>' +
          pasadas.slice(0, 6).map(c => tarjetaCita(c, { compacta: true })).join('') + '</div>'
        : '') +

      (!u
        ? '<div class="card p16" style="gap:8px"><div class="row" style="gap:10px">' +
          '<span class="mute">' + ic('info', 18) + '</span>' +
          '<span class="cap mute grow">Como invitado, tus citas se guardan solo en este teléfono. ' +
          'Si creás tu cuenta, las pasamos a tu nombre.</span></div></div>'
        : '') +

      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Detalle de una cita (es tambien la pantalla de confirmacion)
   ------------------------------------------------------------ */
vistas.cita = () => {
  const u = usuario();
  const cita = citaActual();
  if (!cita){
    return {
      nav: 'citas', titulo: 'Cita no encontrada',
      html: '<div class="screen"><div class="stack">' +
        '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
        encabezado('Cita', 'No encontramos<br>esa cita') +
        '<p class="body mute">Puede que se haya borrado o que sea de otra cuenta.</p>' +
        boton('Ver mis citas', 'tabCitas', { clase: 'darkp' }) + '</div></div>'
    };
  }

  const d = medico(cita.medicoId);
  const recien = Date.now() - cita.creada < 90000 && cita.estado === ESTADOS.AGENDADA && !cita.cambios;
  const cancelada = cita.estado === ESTADOS.CANCELADA;
  const atendida = cita.estado === ESTADOS.ATENDIDA;
  const url = urlComprobante(cita);
  const minutosFaltan = horasFaltantes(cita.fecha, cita.hora) * 60;
  const puedeCheckIn = cita.estado === ESTADOS.AGENDADA && minutosFaltan <= 120 && minutosFaltan >= -30;
  const puedeCambiar = cita.estado === ESTADOS.AGENDADA && horasFaltantes(cita.fecha, cita.hora) >= REGLAS.horasMinimasParaCambiar;

  const titulo = cancelada ? 'Esta cita está<br>cancelada'
    : atendida ? 'Consulta<br>realizada'
    : recien ? (cita.control ? '¡Listo!<br>Tu control está<br>agendado.' : '¡Listo!<br>Tu cita está<br>confirmada.')
    : cita.cambios ? 'Cita<br>reprogramada'
    : 'Tu cita';

  const banner = cancelada
    ? '<div class="card dangerc" style="padding:24px;gap:12px;border-radius:32px">' +
      '<span class="cb fill" style="color:var(--danger)">' + ic('close') + '</span>' +
      '<h1 class="hero" style="margin:0;font-weight:400;color:var(--danger)">' + titulo + '</h1>' +
      '<div class="body mute">Liberamos el horario del ' + fechaLarga(cita.fecha).toLowerCase() + ' a las ' +
      hora12(cita.hora) + ' con ' + nombreCon(d) + '. No hay cargo por cancelar.</div></div>'
    : '<div class="card ' + (atendida ? 'okc' : 'brand') + '" style="padding:24px;gap:14px;border-radius:32px">' +
      (atendida ? '' : manchas([['#9DB0FF', 200, 190, -70, .8]])) +
      '<span class="content cb fill" style="color:' + (atendida ? 'var(--ok)' : 'var(--brand)') + '">' + ic('check') + '</span>' +
      '<h1 class="content hero" style="margin:0;font-weight:400">' + titulo + '</h1>' +
      '<div class="content body" style="opacity:.82">' +
      (atendida ? 'Todo quedó guardado en tu expediente.'
                : fechaLarga(cita.fecha) + ' a las ' + hora12(cita.hora) + ' · ' + faltan(cita.fecha, cita.hora)) +
      '</div></div>';

  return {
    nav: 'citas',
    titulo: 'Detalle de la cita',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button>' +
      '<div class="grow"></div>' + pastillaEstado(cita) + '</div>' +

      banner +

      // Pase de llegada con QR real
      (cancelada || atendida ? '' :
        '<div class="card" style="gap:14px">' +
        '<div class="row" style="gap:16px">' +
        '<button class="qr-caja tap" data-act="hoja" data-v="qr" aria-label="Ampliar el código QR de tu cita">' +
        qrSvg(url, { tamano: 104, titulo: 'Código QR de la cita ' + cita.codigo }) + '</button>' +
        '<div class="grow stack" style="gap:6px"><span class="ct">Tu pase de llegada</span>' +
        '<span class="cap mute">Escanealo en recepción para hacer el check-in sin fila. ' +
        'Se activa 2 horas antes de tu cita.</span>' +
        '<span class="pill sm fieldbg">' + esc(cita.codigo) + '</span></div></div>' +
        (puedeCheckIn
          ? boton('Ya llegué · hacer check-in', 'checkin', { clase: 'darkp', icono: 'qr' })
          : '<div class="row" style="gap:10px"><span class="mute">' + ic('clock', 16) + '</span>' +
            '<span class="cap mute grow">' + (minutosFaltan > 120
              ? 'El check-in se habilita 2 horas antes (' + faltan(cita.fecha, cita.hora) + ').'
              : 'La ventana de check-in ya pasó: acercate a recepción.') + '</span></div>') +
        '</div>') +

      detalleCita(cita) +

      // Estado real del correo
      '<div class="card p16" style="gap:12px">' +
      '<div class="row" style="gap:10px"><span class="cb s40 field">' + ic('mail', 18) + '</span>' +
      '<div class="grow stack" style="gap:4px"><span class="bm">Confirmación por correo</span>' +
      insigniaEnvio(cita) + '</div></div>' +
      (cita.notificacion?.estado === 'fallo'
        ? '<span class="cap mute">' + esc(cita.notificacion.error || '') + '. Tu cita sigue guardada.</span>' +
          boton('Reintentar el envío', 'reintentarCorreo', { clase: 'fieldbg', icono: 'refresh' })
        : cita.notificacion?.estado === 'apagado'
          ? '<span class="cap mute">Las automatizaciones todavía no están conectadas en esta demo. ' +
            'Se configuran en Perfil → Ajustes de la demo.</span>'
          : '') +
      '</div>' +

      // Calendario
      (cancelada ? '' :
        '<div class="row" style="gap:10px">' +
        '<button class="pill h52 white tap grow" data-act="hoja" data-v="calendario" style="justify-content:center">' +
        ic('calendar', 18) + 'Agregar al calendario</button>' +
        '<button class="cb s52 fill tap" data-act="comoLlegar" aria-label="Cómo llegar">' + ic('navigate') + '</button></div>') +

      // Cambiar o cancelar
      (cita.estado === ESTADOS.AGENDADA
        ? (puedeCambiar
            ? boton('Cambiar o cancelar cita', 'hoja', { valor: 'cambiar', clase: 'white', icono: 'calendar' })
            : '<div class="card warn" style="gap:8px"><div class="row top">' +
              '<span style="color:var(--warn)">' + ic('info', 18) + '</span>' +
              '<span class="cap mute grow">Faltan menos de ' + REGLAS.horasMinimasParaCambiar +
              ' horas: para cambiarla llamá a la clínica al ' + APP.clinica.telefono + '.</span></div></div>')
        : cancelada
          ? boton('Agendar otra cita', 'irAgendar', { clase: 'darkp', icono: 'plus' })
          : '') +

      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Reprogramar
   ------------------------------------------------------------ */
vistas.reprogramar = () => {
  const u = usuario();
  const cita = citaActual();
  if (!cita) return vistas.cita();
  const d = medico(cita.medicoId);
  const fechas = diasVisibles();
  const fecha = S.nuevaFecha || cita.fecha;
  const lleno = diaLleno(d.id, fecha, u?.id || null) && fecha !== cita.fecha;
  const cambio = S.nuevaHora && !(fecha === cita.fecha && S.nuevaHora === cita.hora);

  return {
    titulo: 'Cambiar la cita',
    html:
      '<div class="screen"><div class="stack gap24">' +
      cabeceraMedico(d, { comoTitulo: false }) +

      '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s40 bsoft">' + ic('calendar', 18) + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="cap mute">Tu cita actual</span>' +
      '<span class="bm">' + fechaLarga(cita.fecha) + ' · ' + hora12(cita.hora) + '</span></div></div>' +

      '<div class="card" style="gap:16px"><div class="ct">Elegí el nuevo día</div>' +
      selectorDias(d.id, fecha, 'nuevoDia', u?.id || null, fechas) +
      (lleno
        ? diaSinCupos(d, fecha, u?.id || null)
        : '<div class="ct">Elegí el nuevo horario</div>' +
          rejillaHorarios(d.id, fecha, S.nuevaHora, 'nuevaHora',
                          { usuarioId: u?.id || null, horaActual: fecha === cita.fecha ? cita.hora : null })) +
      '</div>' +

      (S.ultimoError ? avisoCaja('danger', '!', 'No pudimos cambiar la cita', esc(S.ultimoError)) : '') +
      '</div></div>' +
      accion(S.reservando ? 'Cambiando…'
                          : cambio ? 'Cambiar a ' + fechaMedia(fecha) + ', ' + hora12(S.nuevaHora)
                                   : 'Elegí un nuevo horario',
             'confirmarCambio',
             { estado: S.reservando ? 'cargando' : cambio ? 'normal' : 'off' })
  };
};

/* ------------------------------------------------------------
   Confirmacion de cancelacion
   ------------------------------------------------------------ */
vistas.cancelada = () => ({
  titulo: 'Cita cancelada',
  html:
    '<div class="screen"><div class="stack gap24" style="padding-top:12px">' +
    '<span class="cb s52 ok">' + ic('check') + '</span>' +
    '<h1 class="hero" style="margin:0;font-weight:400">Cancelaste<br>tu cita</h1>' +
    '<p class="body mute" style="margin:0">' + esc(S.textoCancelacion || '') + '</p>' +
    boton('Agendar otra cita', 'irAgendar', { clase: 'white' }) +
    '</div></div>' +
    accion('Volver al inicio', 'tabInicio')
});

/* ------------------------------------------------------------
   Acciones
   ------------------------------------------------------------ */
export const acciones = {
  verCita(v){ S.citaId = v; ir('cita'); },
  tabCitas(){ tabear('citas'); },
  tabInicio(){ tabear('inicio'); },

  comoLlegar(){
    window.open(APP.clinica.mapa, '_blank', 'noopener');
    avisar('Abriendo el mapa en otra pestaña');
  },

  /* --- check-in con el QR --- */
  checkin(){
    const u = usuario();
    const cita = citaActual();
    if (!cita) return;
    const r = checkIn({ codigo: cita.codigo, usuarioId: u?.id || null });
    if (!r.ok){
      log('check-in RECHAZADO · ' + r.codigo, 'err');
      avisar(r.error, 'err');
      repintar();
      return;
    }
    marcarCaso('C2');
    log('cita ' + cita.codigo + ' -> EN_SALA (check-in con QR)', 'ok');
    S.turno = 2;
    avisar('Check-in listo. ¡Bienvenido!', 'ok');
    ir('sala');
  },

  /* --- reprogramar --- */
  irReprogramar(){
    const cita = citaActual();
    if (!cita) return;
    S.nuevaFecha = cita.fecha;
    S.nuevaHora = null;
    S.ultimoError = null;
    cerrarHoja();
    ir('reprogramar');
  },
  nuevoDia(v){ S.nuevaFecha = v; S.nuevaHora = null; repintar(); },
  nuevaHora(v){ S.nuevaHora = v; repintar(); },

  async confirmarCambio(){
    if (S.reservando) return;
    const u = usuario();
    const cita = citaActual();
    if (!cita || !S.nuevaHora) return;

    S.reservando = true; S.ultimoError = null; repintar();
    const r = reprogramar({
      citaId: cita.id,
      fecha: S.nuevaFecha || cita.fecha,
      hora: S.nuevaHora,
      usuarioId: u?.id || null
    });
    S.reservando = false;

    if (!r.ok){
      S.ultimoError = r.error;
      log('reprogramar() -> RECHAZADA · ' + (r.codigo || ''), 'err');
      avisar(r.error, 'err');
      repintar();
      return;
    }

    marcarCaso('C2');
    log('cita ' + r.cita.codigo + ' reprogramada · ' + r.antes.fecha + ' ' + r.antes.hora +
        ' → ' + r.cita.fecha + ' ' + r.cita.hora + ' · horario anterior LIBERADO', 'ok');
    avisar('Listo, cambiamos tu cita', 'ok');
    S.historial = [];
    ir('cita', { reemplazar: true });

    const res = await avisarCambio(r.cita, perfil(), r.antes);
    log('n8n · cambio -> ' + (res.ok ? 'correo enviado' : res.estado), res.ok ? 'ok' : 'err');
    repintar();
  },

  /* --- cancelar --- */
  async cancelarCita(){
    const u = usuario();
    const cita = citaActual();
    if (!cita) return;
    const d = medico(cita.medicoId);

    const r = cancelar({ citaId: cita.id, usuarioId: u?.id || null, razon: 'El paciente la canceló desde la app' });
    if (!r.ok){
      avisar(r.error, 'err');
      cerrarHoja();
      return;
    }

    marcarCaso('C2');
    log('cita ' + cita.codigo + ' -> CANCELADA · horario liberado', 'ok');
    S.textoCancelacion = 'Liberamos tu horario del ' + fechaLarga(cita.fecha).toLowerCase() + ' a las ' +
      hora12(cita.hora) + ' con ' + nombreCon(d) + '. No hay cargo por cancelar y, si habías pagado en línea, ' +
      'el reembolso iría a la misma tarjeta (simulado).';
    S.hoja = null;
    S.historial = [];
    ir('cancelada', { reemplazar: true });

    const res = await avisarCancelacion(r.cita, perfil());
    log('n8n · cancelación -> ' + (res.ok ? 'correo enviado' : res.estado), res.ok ? 'ok' : 'err');
  },

  /* --- correo --- */
  async reintentarCorreo(){
    const cita = citaActual();
    if (!cita) return;
    avisar('Reintentando el envío…');
    repintar();
    const res = await avisarReserva(cita, perfil());
    log('n8n · reintento -> ' + (res.ok ? 'correo enviado' : res.estado), res.ok ? 'ok' : 'err');
    avisar(res.ok ? 'Correo enviado' : 'Sigue sin poder enviarse', res.ok ? 'ok' : 'err');
    repintar();
  }
};
