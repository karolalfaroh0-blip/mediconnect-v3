/* ============================================================
   MediConnect · pantallas/agendar.js
   Buscar medico, elegir dia y hora, revisar y confirmar.
   Tambien el pago simulado y el calendario del control.
   ============================================================ */

import { ic, esc, cara, manchas, accion, encabezado, boton, interruptor,
         monograma, aviso as avisoCaja, simulado, vacio, cargandoTarjetas } from '../nucleo/ui.js';
import { S, ir, abrirHoja, avisar, repintar, log, marcarCaso, usuario, perfil, seguros } from '../nucleo/estado.js';
import { medicos, medico, nombreCortoSeguro, NombreCon, esDoctora } from '../nucleo/datos.js';
import { diasVisibles, horariosLibres, diaLleno, proximoHueco, reservar } from '../nucleo/agenda.js';
import { hoy, fechaLarga, fechaMedia, hora12, relativa, sumarDias, esFinDeSemana, MESL } from '../nucleo/fechas.js';
import { avisarReserva } from '../nucleo/automatizacion.js';
import { nuevoId } from '../nucleo/almacen.js';
import { cabeceraMedico, selectorDias, rejillaHorarios, diaSinCupos, filaMedico, detalleCita } from './comunes.js';

export const vistas = {};

/* ------------------------------------------------------------
   Como queda el seguro para esta cita.
   El panel del presentador puede forzar los escenarios del caso C4.
   ------------------------------------------------------------ */
export function evaluarSeguro(doc){
  const mis = seguros();
  if (!mis.length) return { estado: 'sin', seguro: null };

  if (S.demo.seguro === 'vencido'){
    const v = mis.find(s => !s.vigente) || mis[0];
    return { estado: 'vencido', seguro: v };
  }
  if (S.demo.seguro === 'noacepta'){
    const n = mis.find(s => s.vigente && !doc.nets.includes(s.id)) || mis.find(s => s.vigente) || mis[0];
    return { estado: 'noacepta', seguro: n };
  }

  const elegido = mis.find(s => s.id === S.seguroElegido);
  const candidato = elegido || mis.find(s => s.principal) || mis[0];
  if (!candidato) return { estado: 'sin', seguro: null };
  if (!candidato.vigente) return { estado: 'vencido', seguro: candidato };
  if (!doc.nets.includes(candidato.id)) return { estado: 'noacepta', seguro: candidato };
  return { estado: 'cubre', seguro: candidato };
}

const seguroPrincipal = () => seguros().find(s => s.principal) || seguros()[0] || null;

/* ------------------------------------------------------------
   Agendar · lista de medicos
   ------------------------------------------------------------ */
vistas.agendar = () => {
  const u = usuario();
  const mis = seguros().filter(s => s.vigente).map(s => s.id);
  const q = S.q.trim().toLowerCase();
  const chips = ['Todos', 'General', 'Piel', 'Corazón', 'Niños', 'Mujer', 'Nutrición'];

  const lista = medicos.filter(d =>
    (S.chip === 'Todos' || d.chip === S.chip) &&
    (!S.soloCubiertos || d.nets.some(n => mis.includes(n))) &&
    (!q || (d.n + ' ' + d.sp + ' ' + d.place).toLowerCase().includes(q))
  );

  const cuerpo = S.cargandoLista
    ? cargandoTarjetas(3)
    : lista.length
      ? lista.map(d => {
          const hueco = proximoHueco(d.id, u?.id || null);
          const cubre = mis.find(id => d.nets.includes(id));
          return '<div class="card p16" style="gap:16px">' +
            '<button class="row tap" data-act="verMedico" data-v="' + d.id + '" style="gap:14px;text-align:left">' +
            cara(d.f, 56) +
            '<div class="grow stack" style="gap:3px"><span class="ct">' + esc(d.n) + '</span>' +
            '<span class="cap mute">' + esc(d.sp) + ' · ' + esc(d.place) + '</span>' +
            '<span class="row" style="gap:4px;color:var(--star)">' + ic('star', 13) +
            '<span class="label" style="color:var(--ink)">' + d.rate + '</span>' +
            '<span class="cap mute">· $' + d.price + '</span></span></div>' +
            (cubre ? '<span class="pill sm okp">Cubre ' + esc(nombreCortoSeguro(cubre)) + '</span>' : '') +
            '</button>' +
            (hueco
              ? '<button class="row tap" data-act="irAHuecoDe" data-v="' + d.id + '|' + hueco.fecha + '|' + hueco.hora + '" ' +
                'style="height:52px;border-radius:26px;background:var(--field);padding:0 6px 0 14px;gap:10px">' +
                '<span class="mute">' + ic('clock', 18) + '</span>' +
                '<span class="label mute">Próximo:</span>' +
                '<span class="label grow" style="text-align:left">' + esc(relativa(hueco.fecha)) + ', ' + hora12(hueco.hora) + '</span>' +
                '<span class="cb s40 brand">' + ic('right', 18) + '</span></button>'
              : '<div class="row" style="height:52px;border-radius:26px;background:var(--field);padding:0 14px;gap:10px">' +
                '<span class="mute">' + ic('calendar', 18) + '</span>' +
                '<span class="label mute grow">Sin cupos esta semana</span></div>') +
            '</div>';
        }).join('')
      : vacio('No encontramos médicos',
              S.soloCubiertos ? 'Probá con otra especialidad o apagá el filtro de seguro.' : 'Probá con otro nombre o especialidad.',
              S.soloCubiertos ? 'Mostrar todos los médicos' : null, 'quitarFiltro');

  return {
    nav: 'citas',
    titulo: 'Agendar una cita',
    html:
      '<div class="screen"><div class="stack" style="gap:20px">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Agendar', '¿Con quién te<br>querés atender?') +

      '<label class="search"><span class="mute">' + ic('search') + '</span>' +
      '<input id="q" type="search" placeholder="Buscá un médico o especialidad" value="' + esc(S.q) + '" ' +
      'autocomplete="off" aria-label="Buscar médico o especialidad"></label>' +

      '<div class="chips" role="group" aria-label="Filtrar por especialidad">' +
      chips.map(c => '<button class="pill h40 ' + (S.chip === c ? 'darkp' : 'white') + '" data-act="chip" data-v="' + c + '"' +
        ' aria-pressed="' + (S.chip === c) + '">' + c + '</button>').join('') +
      '<button class="pill h40 white" data-act="hoja" data-v="especialista">' + ic('plus', 16) + 'Más</button></div>' +

      (u && seguros().length
        ? '<div class="row" style="gap:10px"><span style="color:var(--ok)">' + ic('shield') + '</span>' +
          '<span class="body grow">Solo médicos que cubre mi seguro</span>' +
          interruptor(S.soloCubiertos, 'soloCubiertos', undefined, 'Solo médicos que cubre mi seguro') + '</div>'
        : '') +

      '<div class="stack" style="gap:12px">' + cuerpo + '</div>' +
      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Ficha del medico y eleccion de dia y hora
   ------------------------------------------------------------ */
vistas.medico = () => {
  const u = usuario();
  const d = medico(S.medicoId);
  const fechas = diasVisibles();
  // Si todavía no se eligió día, se arranca en el primero disponible
  if (!S.fecha) S.fecha = fechas[0];
  const fecha = S.fecha;
  const lleno = diaLleno(d.id, fecha, u?.id || null);
  if (lleno) marcarCaso('C1');
  const libres = horariosLibres(d.id, fecha, u?.id || null).length;

  return {
    titulo: d.n,
    html:
      '<div class="screen"><div class="stack gap24">' +
      cabeceraMedico(d, { seguroPrincipal: seguroPrincipal() }) +
      '<p class="body mute" style="margin:-8px 0 0">' + esc(d.desc) + '</p>' +

      '<div class="card" style="gap:16px">' +
      '<div class="row"><span class="ct grow">Elegí el día</span>' +
      '<span class="cap mute">' + (libres ? libres + (libres === 1 ? ' horario libre' : ' horarios libres') : 'sin cupos') + '</span></div>' +
      selectorDias(d.id, fecha, 'elegirDia', u?.id || null, fechas) +
      (lleno
        ? diaSinCupos(d, fecha, u?.id || null)
        : '<div class="ct">Horarios libres</div>' +
          rejillaHorarios(d.id, fecha, S.hora, 'elegirHora', { usuarioId: u?.id || null })) +
      '</div>' +

      '<div class="card p16" style="gap:8px"><div class="row" style="gap:10px">' +
      '<span class="mute">' + ic('info', 18) + '</span>' +
      '<span class="cap mute grow">La consulta dura 30 minutos. Llegá 10 minutos antes para el check-in.</span></div></div>' +

      '</div></div>' +
      (lleno ? ''
             : accion(S.hora ? 'Continuar · ' + fechaMedia(fecha) + ', ' + hora12(S.hora) : 'Elegí un horario',
                      'irConfirmar', { estado: S.hora ? 'normal' : 'off' }))
  };
};

/* ------------------------------------------------------------
   Revisar la cita antes de confirmar
   ------------------------------------------------------------ */
vistas.confirmar = () => {
  const u = usuario();
  const d = medico(S.medicoId);
  const ev = evaluarSeguro(d);
  const cubre = ev.estado === 'cubre';
  const nombreSeguro = ev.seguro ? nombreCortoSeguro(ev.seguro.id) : null;
  const citaPreview = { medicoId: d.id, fecha: S.fecha, hora: S.hora, duracionMin: 30 };

  const tarjetaSeguro = u
    ? '<button class="card p16 tap" data-act="hoja" data-v="elegirSeguro" ' +
      'style="flex-direction:row;align-items:center;gap:12px;text-align:left">' +
      '<span class="cb s44 ' + (cubre ? 'ok' : 'warn') + '">' + ic('shield') + '</span>' +
      '<span class="grow stack" style="gap:2px">' +
      '<span class="ct">' + (ev.seguro ? 'Tu seguro ' + esc(nombreSeguro) : 'Sin seguro') + '</span>' +
      '<span class="cap mute">' + (
        ev.estado === 'cubre' ? 'Lo validamos por vos al instante' :
        ev.estado === 'vencido' ? 'La póliza aparece vencida' :
        ev.estado === 'noacepta' ? (esDoctora(d) ? 'Esta médica' : 'Este médico') + ' no lo acepta' :
        'Pagás la consulta directo') + '</span></span>' +
      '<span class="pill sm ' + (cubre ? 'okp' : 'warnp') + '">' + (cubre ? 'Cubierto' : ev.seguro ? 'Revisar' : '—') + '</span>' +
      '</button>'
    : '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s44 field">' + ic('shield') + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="ct">Sin seguro registrado</span>' +
      '<span class="cap mute">Los seguros se guardan en tu cuenta.</span></div></div>';

  return {
    titulo: 'Revisá tu cita',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Casi listo', S.esControl ? 'Revisá tu control' : 'Revisá tu cita') +

      detalleCita(citaPreview) +
      tarjetaSeguro +

      '<div class="card dark" style="padding:22px;gap:4px">' + manchas([['#3B5BF6', 220, 170, -60, .9]]) +
      '<span class="content body dim">Pagás hoy</span>' +
      '<span class="content num">$' + (cubre ? '0.00' : d.price + '.00') + '</span>' +
      '<span class="content cap dim">' + (cubre
        ? 'Tu seguro cubre los $' + d.price + ' de la consulta.'
        : 'Podés pagar en línea o en la clínica.') + '</span>' +
      '<div class="content" style="padding-top:8px">' + simulado('Cobros simulados') + '</div></div>' +

      (!u
        ? '<div class="card soft" style="gap:10px">' +
          '<div class="row" style="gap:10px"><span class="cb s40 brand">' + ic('mail', 18) + '</span>' +
          '<div class="grow stack" style="gap:2px"><span class="ct">Último paso: tu cuenta</span>' +
          '<span class="cap mute">La cita se guarda a tu nombre y te enviamos la confirmación con fecha, hora, ' +
          'lugar y tu código QR al correo.</span></div></div></div>'
        : '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
          '<span class="cb s40 bsoft">' + ic('mail', 18) + '</span>' +
          '<span class="grow stack" style="gap:2px"><span class="bm">Te enviamos la confirmación a</span>' +
          '<span class="cap mute">' + esc(u.correo || (perfil() && perfil().correo) || '') + '</span></span></div>') +

      (S.ultimoError ? avisoCaja('danger', '!', 'No pudimos guardar la cita', esc(S.ultimoError)) : '') +
      '</div></div>' +
      accion(
        S.reservando ? 'Guardando tu cita…'
          : !u ? 'Crear cuenta y confirmar'
          : cubre ? (S.esControl ? 'Confirmar control' : 'Confirmar cita') : 'Continuar al pago',
        cubre ? 'confirmarCita' : 'irPago',
        { estado: S.reservando ? 'cargando' : 'normal' })
  };
};

/* ------------------------------------------------------------
   Pago (simulado)
   ------------------------------------------------------------ */
const metodosPago = () => {
  const opciones = [
    ['VISA', 'Visa •••• 4417', 'Tarjeta guardada'],
    ['+', 'Otra tarjeta', 'Débito o crédito'],
    ['$', 'En la clínica', 'En caja al llegar, puede haber fila']
  ];
  return '<div class="row" style="gap:8px"><span class="ct grow">¿Cómo querés pagar?</span>' + simulado('Simulado') + '</div>' +
    '<div class="stack" style="gap:10px" role="radiogroup" aria-label="Forma de pago">' +
    opciones.map((o, i) =>
      '<button class="card p16 opt tap' + (S.metodoPago === i ? ' on' : '') + '" data-act="metodoPago" data-v="' + i + '" ' +
      'role="radio" aria-checked="' + (S.metodoPago === i) + '" ' +
      'style="flex-direction:row;align-items:center;gap:12px;border-radius:24px;text-align:left">' +
      monograma(o[0], S.metodoPago === i ? 'bsoft' : 'field', 40) +
      '<span class="grow stack" style="gap:2px"><span class="bm">' + o[1] + '</span>' +
      '<span class="cap mute">' + o[2] + '</span></span>' +
      '<span class="radio' + (S.metodoPago === i ? ' on' : '') + '"></span></button>').join('') + '</div>';
};

vistas.pago = () => {
  const d = medico(S.medicoId);
  const ev = evaluarSeguro(d);
  const cuando = fechaMedia(S.fecha) + ' · ' + hora12(S.hora);
  const nombreSeguro = ev.seguro ? nombreCortoSeguro(ev.seguro.id) : '';
  const ella = esDoctora(d);
  marcarCaso('C4');

  let cuerpo = '';
  let titulo = 'Pagá tu<br>consulta';

  if (ev.estado === 'vencido'){
    titulo = 'No pudimos<br>validar tu seguro';
    cuerpo = avisoCaja('warn', 'shield',
      'Tu póliza ' + esc(nombreSeguro) + ' ' + esc(ev.seguro.poliza) + ' aparece vencida',
      'No podemos usarla para esta cita. No se hizo ningún cobro y tu horario sigue apartado. ' +
      'Podés elegir otro seguro o pagar sin seguro.') +
      boton('Elegir otro seguro', 'hoja', { valor: 'elegirSeguro' }) +
      filaMedico(d, cuando) + metodosPago();
  } else if (ev.estado === 'noacepta'){
    const aceptados = d.nets.map(n => nombreCortoSeguro(n)).join(', ').replace(/, ([^,]*)$/, ' y $1');
    titulo = 'Tu seguro no aplica<br>con ' + (ella ? 'esta médica' : 'este médico');
    cuerpo = avisoCaja('warn', 'shield',
      NombreCon(d) + ' no acepta ' + esc(nombreSeguro),
      'Tu póliza está vigente, pero ' + (ella ? 'esta médica' : 'este médico') + ' no trabaja con ' + esc(nombreSeguro) +
      '. No se hizo ningún cobro y tu horario sigue apartado.') +
      filaMedico(d, cuando) +
      '<div class="stack" style="gap:4px"><span class="ct">Otras opciones</span>' +
      '<span class="cap mute">' + (ella ? 'Esta médica' : 'Este médico') + ' acepta ' + esc(aceptados) + '</span></div>' +
      boton('Elegir otro seguro', 'hoja', { valor: 'elegirSeguro' }) + metodosPago();
  } else {
    cuerpo = filaMedico(d, cuando) + metodosPago();
  }

  const etiqueta = S.metodoPago === 2
    ? 'Apartar cita · pago en clínica'
    : (ev.estado === 'cubre' ? 'Pagar $' : 'Pagar sin seguro · $') + d.price + '.00';

  return {
    titulo: 'Pago de la consulta',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Casi listo', titulo) + cuerpo +
      (S.ultimoError ? avisoCaja('danger', '!', 'No pudimos guardar la cita', esc(S.ultimoError)) : '') +
      '</div></div>' +
      accion(S.reservando ? 'Procesando…' : etiqueta, 'pagar', { estado: S.reservando ? 'cargando' : 'normal' })
  };
};

vistas.rechazado = () => {
  const d = medico(S.medicoId);
  const cuando = fechaMedia(S.fecha) + ' · ' + hora12(S.hora);
  return {
    titulo: 'Pago rechazado',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Casi listo', 'No pudimos<br>cobrar tu tarjeta') +
      avisoCaja('danger', '!', 'Tu banco rechazó el pago',
        'No se hizo ningún cobro a tu Visa •••• 4417 y tu horario sigue apartado. ' +
        'Podés reintentar, usar otra tarjeta o pagar en la clínica.') +
      filaMedico(d, cuando) +
      '<div class="row" style="gap:8px"><span class="ct grow">Otras formas de pagar</span>' + simulado('Simulado') + '</div>' +
      boton('Usar otra tarjeta', 'pagoAlterno', { valor: 'tarjeta' }) +
      boton('Pagar en la clínica, al llegar', 'pagoAlterno', { valor: 'clinica' }) +
      '</div></div>' +
      accion(S.reservando ? 'Procesando…' : 'Reintentar con Visa · $' + d.price + '.00', 'reintentarPago',
             { estado: S.reservando ? 'cargando' : 'normal' })
  };
};

/* ------------------------------------------------------------
   Calendario del control (caso C8)
   ------------------------------------------------------------ */
function mesDelControl(){
  if (!S.mesCalendario) S.mesCalendario = (S.fecha || hoy()).slice(0, 7);
  return S.mesCalendario;
}

function calendarioMes(medicoId, usuarioId, sugerida){
  const [anio, mes] = mesDelControl().split('-').map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const desplazamiento = (primero.getUTCDay() + 6) % 7;      // la semana empieza en lunes
  const cuantos = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const minimo = hoy();
  const maximo = sumarDias(minimo, 70);

  let celdas = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    .map(x => '<span class="wd" aria-hidden="true">' + x + '</span>').join('');
  for (let i = 0; i < desplazamiento; i++) celdas += '<span></span>';

  for (let dd = 1; dd <= cuantos; dd++){
    const f = anio + '-' + String(mes).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    const fuera = f < minimo || f > maximo || esFinDeSemana(f);
    const lleno = !fuera && diaLleno(medicoId, f, usuarioId);
    const abierto = !fuera && !lleno;
    const elegido = f === S.fecha;
    const sug = f === sugerida;
    const clase = elegido ? ' on' : lleno ? ' full' : !abierto ? ' off' : '';
    celdas += '<button class="cd tap' + clase + (sug && !elegido ? ' sug' : '') + '" data-act="diaControl" data-v="' + f + '"' +
      (abierto ? '' : ' disabled') +
      ' aria-label="' + fechaLarga(f) + (sug ? ', sugerido por tu médico' : '') +
      (lleno ? ', sin cupos' : abierto ? '' : ', no disponible') + '"' +
      (elegido ? ' aria-pressed="true"' : '') + '>' + dd + '</button>';
  }

  const mesActual = anio + '-' + String(mes).padStart(2, '0');
  return '<div class="calnav"><span class="ct grow" style="text-transform:capitalize">' + MESL[mes - 1] + ' ' + anio + '</span>' +
    '<button class="cb s40 field tap' + (mesActual > minimo.slice(0, 7) ? '' : ' off') + '" data-act="mesControl" data-v="-1" aria-label="Mes anterior">' +
    ic('left', 18) + '</button>' +
    '<button class="cb s40 field tap' + (mesActual < maximo.slice(0, 7) ? '' : ' off') + '" data-act="mesControl" data-v="1" aria-label="Mes siguiente">' +
    '<span style="display:inline-flex;transform:scaleX(-1)">' + ic('left', 18) + '</span></button></div>' +
    '<div class="cal">' + celdas + '</div>' +
    '<div class="legend"><span><i style="background:var(--brand)"></i>Sugerido por tu médico</span>' +
    '<span><i style="background:var(--dark)"></i>Elegido</span>' +
    '<span><i style="background:#D5D8DE"></i>Sin cupos</span></div>';
}

vistas.control = () => {
  const u = usuario();
  const d = medico(S.medicoId);
  const sugerida = S.controlSugerido;
  const libres = S.fecha ? horariosLibres(d.id, S.fecha, u?.id || null) : [];

  return {
    titulo: 'Agendar el control',
    html:
      '<div class="screen"><div class="stack gap24">' +
      cabeceraMedico(d, { seguroPrincipal: seguroPrincipal(), comoTitulo: false }) +
      encabezado('Tu control', 'Elegí cuándo<br>volver') +

      '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s40 bsoft">' + ic('calendar', 18) + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="cap mute">' + NombreCon(d) + ' te sugiere</span>' +
      '<span class="bm">' + fechaLarga(sugerida) + '</span></div>' +
      '<button class="pill sm white tap" data-act="diaControl" data-v="' + sugerida + '">Usar</button></div>' +

      '<div class="card" style="gap:16px">' + calendarioMes(d.id, u?.id || null, sugerida) + '</div>' +

      '<div class="card" style="gap:16px">' +
      '<div class="ct">Horarios libres · ' + (S.fecha ? fechaMedia(S.fecha) : 'elegí un día') + '</div>' +
      (S.fecha
        ? (libres.length
            ? rejillaHorarios(d.id, S.fecha, S.hora, 'elegirHora', { usuarioId: u?.id || null })
            : '<p class="body mute">Ese día ya no tiene cupos. Elegí otro en el calendario.</p>')
        : '<p class="body mute">Tocá un día del calendario para ver sus horarios.</p>') +
      '</div>' +

      '</div></div>' +
      accion(S.hora ? 'Continuar · ' + fechaMedia(S.fecha) + ', ' + hora12(S.hora) : 'Elegí un horario',
             'irConfirmar', { estado: S.hora ? 'normal' : 'off' })
  };
};

/* ------------------------------------------------------------
   Guardar la cita de verdad, y recien despues avisar por correo
   ------------------------------------------------------------ */
export async function guardarCita({ modoPago }){
  if (S.reservando) return;
  const u = usuario();
  S.reservando = true;
  S.ultimoError = null;
  repintar();

  if (!S.claveIdem) S.claveIdem = nuevoId('idem');

  const d = medico(S.medicoId);
  const ev = evaluarSeguro(d);

  const r = reservar({
    medicoId: S.medicoId,
    fecha: S.fecha,
    hora: S.hora,
    usuarioId: u?.id || null,
    claveIdem: S.claveIdem,
    control: S.esControl,
    motivo: { sintomas: [...S.sintomas], desde: S.sintomas.size ? S.desde : null },
    pago: {
      modo: modoPago,
      seguroId: ev.estado === 'cubre' ? ev.seguro.id : null,
      monto: ev.estado === 'cubre' ? 0 : d.price,
      estado: modoPago === 'seguro' ? 'cubierto' : modoPago === 'clinica' ? 'pendiente' : 'pagado'
    }
  });

  S.reservando = false;

  if (!r.ok){
    S.ultimoError = r.error;
    log('reservar() -> RECHAZADA · ' + r.codigo, 'err');
    avisar(r.error, 'err');
    repintar();
    return;
  }

  if (r.repetida) log('reservar() · clave de idempotencia repetida -> no se duplicó', 'ok');
  else log('cita ' + r.cita.codigo + ' AGENDADA · ' + r.cita.fecha + ' ' + r.cita.hora, 'ok');

  marcarCaso(S.esControl ? 'C8' : 'C3');
  S.claveIdem = null;
  S.citaId = r.cita.id;
  S.esControl = false;
  S.historial = [];
  S.sintomas = new Set();
  ir('cita', { reemplazar: true });

  // El correo va despues: si falla, la cita ya quedo guardada.
  const res = await avisarReserva(r.cita, perfil());
  log('n8n · reserva -> ' + (res.ok ? 'correo enviado' : res.estado), res.ok ? 'ok' : 'err');
  repintar();
}

/* Para confirmar hace falta cuenta: con ella se guarda la cita y llega el correo.
   Se va directo al registro y, al terminar, se vuelve a esta misma cita. */
function pedirCuenta(){
  S.auth = { modo: 'registro', nombre: '', correo: '', clave: '', verClave: false,
             errores: {}, enviando: false, error: null, destino: 'confirmar' };
  log('confirmar sin cuenta -> registro primero (la cita espera)');
  ir('cuenta');
}

/* ------------------------------------------------------------
   Acciones
   ------------------------------------------------------------ */
export const acciones = {
  chip(v){ S.chip = v; repintar(); },
  soloCubiertos(){ S.soloCubiertos = !S.soloCubiertos; repintar(); },
  quitarFiltro(){ S.soloCubiertos = false; S.chip = 'Todos'; S.q = ''; repintar(); },

  irAHuecoDe(v){
    const [id, fecha, hora] = v.split('|');
    S.medicoId = id; S.fecha = fecha; S.hora = hora; S.esControl = false;
    ir('medico');
  },
  irAHueco(v){
    const [fecha, hora] = v.split('|');
    S.fecha = fecha; S.hora = hora;
    repintar();
  },

  elegirDia(v){
    const u = usuario();
    S.fecha = v;
    S.hora = null;
    log('agenda.día = ' + v + ' · ' + horariosLibres(S.medicoId, v, u?.id || null).length + ' libres');
    repintar();
  },
  elegirHora(v){ S.hora = v; log('agenda.hora = ' + v); repintar(); },

  irConfirmar(){
    if (!S.hora) return;
    S.claveIdem = nuevoId('idem');
    S.ultimoError = null;
    const ev = evaluarSeguro(medico(S.medicoId));
    log('¿seguro vigente Y médico lo acepta? ' + (ev.estado === 'cubre' ? 'SÍ → $0' : 'NO → pago directo'));
    ir('confirmar');
  },

  confirmarCita(){
    if (!usuario()){ pedirCuenta(); return; }
    guardarCita({ modoPago: 'seguro' });
  },

  irPago(){
    if (!usuario()){ pedirCuenta(); return; }
    S.metodoPago = 0;
    ir('pago');
  },

  pagar(){
    const d = medico(S.medicoId);
    if (S.metodoPago !== 2 && S.demo.pago === 'fail'){
      S.demo.pago = 'ok';                        // el rechazo pasa una sola vez
      log('pago.cobrar() -> RECHAZADO · la cita todavía no se guarda', 'err');
      marcarCaso('C4');
      ir('rechazado');
      return;
    }
    log(S.metodoPago === 2 ? 'pago = EN_CLINICA' : 'pago.cobrar() -> APROBADO · $' + d.price, 'ok');
    guardarCita({ modoPago: S.metodoPago === 2 ? 'clinica' : 'tarjeta' });
  },

  reintentarPago(){ log('pago.reintentar() -> APROBADO', 'ok'); guardarCita({ modoPago: 'tarjeta' }); },

  pagoAlterno(v){
    if (v === 'clinica'){ S.metodoPago = 2; guardarCita({ modoPago: 'clinica' }); }
    else guardarCita({ modoPago: 'tarjeta' });
  },

  metodoPago(v){ S.metodoPago = +v; repintar(); },

  diaControl(v){
    const u = usuario();
    S.fecha = v;
    S.mesCalendario = v.slice(0, 7);
    const libres = horariosLibres(S.medicoId, v, u?.id || null);
    S.hora = libres.length ? libres[0].hora : null;
    repintar();
  },
  mesControl(v){
    const [a, m] = mesDelControl().split('-').map(Number);
    const nuevo = new Date(Date.UTC(a, m - 1 + Number(v), 1));
    S.mesCalendario = nuevo.getUTCFullYear() + '-' + String(nuevo.getUTCMonth() + 1).padStart(2, '0');
    repintar();
  }
};
