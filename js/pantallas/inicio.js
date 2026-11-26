/* ============================================================
   MediConnect · pantallas/inicio.js
   Bienvenida, pantalla de Inicio y menu de ajustes y ayuda.
   ============================================================ */

import { ic, esc, cara, caraIniciales, manchas, accion, accionEnLinea, encabezado, boton, interruptor, simulado } from '../nucleo/ui.js';
import { S, ir, tabear, abrirHoja, avisar, log, usuario, perfil } from '../nucleo/estado.js';
import { proximaCita, citasDe, ESTADO_ACTIVO } from '../nucleo/agenda.js';
import { medico } from '../nucleo/datos.js';
import { fechaMedia, hora12, relativa, faltan } from '../nucleo/fechas.js';
import { primerNombre } from '../nucleo/cuenta.js';
import { configurado } from '../nucleo/automatizacion.js';
import { almacenamientoDisponible } from '../nucleo/almacen.js';
import { insigniaEnvio } from './comunes.js';

export const vistas = {};

/* ------------------------------------------------------------
   Bienvenida
   Se puede entrar sin cuenta: explorar primero, registrarse solo
   cuando haga falta guardar una cita.
   ------------------------------------------------------------ */
vistas.bienvenida = () => ({
  oscura: true,
  titulo: 'Bienvenida a MediConnect',
  html:
    '<div class="screen" style="padding-bottom:40px;display:flex;flex-direction:column;overflow:hidden">' +
    manchas([['#2F4BF0', 460, -70, 40], ['#6F86FF', 260, 120, 90, .9], ['#C9D3FF', 150, 190, 150, .7]]) +
    '<div class="grow"></div>' +
    '<div class="content stack" style="gap:16px">' +
    '<p class="body inv dim" style="margin:0">Bienvenido a MediConnect</p>' +
    '<h1 class="hero-xl inv" style="margin:0;font-weight:400">Tu cita médica,<br><b style="font-weight:500">sin filas</b> y en<br>minutos.</h1>' +
    '<p class="body inv dim" style="margin:0;max-width:300px">Mirá cómo funciona sin registrarte. ' +
    'La cuenta se pide solo cuando querés guardar una cita.</p>' +
    '</div>' +
    '<div class="content stack" style="gap:4px;padding-top:28px">' +
    accionEnLinea('Empezar a explorar', 'empezar') +
    '<button class="tap bm inv" data-act="irCuenta" data-v="sesion" ' +
    'style="padding:14px;text-align:center;opacity:.9">Ya tengo cuenta · Iniciar sesión</button>' +
    '</div></div>'
});

/* ------------------------------------------------------------
   Inicio
   ------------------------------------------------------------ */
vistas.inicio = () => {
  const u = usuario();
  const p = perfil();
  const nombre = p ? primerNombre(p.nombre) : null;
  const cita = proximaCita(u?.id || null);
  const d = cita ? medico(cita.medicoId) : null;

  const saludo = nombre
    ? '<p class="body mute" style="margin:0">' + esc(nombre) + '</p>' +
      '<h1 class="hero" style="margin:0;font-weight:400">¡Buenas! ¿Qué<br>necesitás hoy?</h1>'
    : '<p class="body mute" style="margin:0">Estás explorando como invitado</p>' +
      '<h1 class="hero" style="margin:0;font-weight:400">¿Qué necesitás<br>hoy?</h1>';

  const avatar = p
    ? (p.foto ? cara({ photo: p.foto }, 52) : caraIniciales(p.nombre, 52))
    : '<span class="cb s52 field">' + ic('user', 22) + '</span>';

  return {
    nav: 'inicio',
    titulo: 'Inicio',
    html:
      '<div class="screen"><div class="stack gap24">' +

      '<div class="row">' +
      '<button class="cb tap" data-act="menu" aria-label="Menú y ajustes">' + ic('menu') + '</button>' +
      '<div class="grow"></div>' +
      '<button class="cb tap" data-act="irAgendar" aria-label="Buscar un médico">' + ic('search') + '</button>' +
      '<button class="tap" data-tab="perfil" aria-label="Tu perfil">' + avatar + '</button></div>' +

      '<div class="stack" style="gap:6px">' + saludo + '</div>' +

      // Accesos rapidos a medicos
      '<div class="people">' +
      '<button class="p tap" data-act="irAgendar"><span class="cb s60">' + ic('plus') + '</span>' +
      '<span class="label">Nueva cita</span><span class="cap mute">Agendar</span></button>' +
      ['tak', 'riv', 'her', 'pen'].map(id => {
        const x = medico(id);
        return '<button class="p tap" data-act="verMedico" data-v="' + id + '">' + cara(x.f, 60) +
          '<span class="label">' + esc(x.short) + '</span><span class="cap mute">' + esc(x.tag) + '</span></button>';
      }).join('') + '</div>' +

      // Proxima cita (de verdad, leida de la agenda)
      '<div class="stack" style="gap:12px">' +
      (cita
        ? '<button class="card tap" data-act="verCita" data-v="' + cita.id + '" style="gap:14px;text-align:left">' +
          '<div class="row" style="gap:8px"><span class="ct">Tu próxima cita</span>' +
          '<span class="badge">' + esc(relativa(cita.fecha)) + '</span><span class="grow"></span>' +
          '<span class="cb s40">' + ic('right', 18) + '</span></div>' +
          '<div class="title">' + fechaMedia(cita.fecha) + ' · ' + hora12(cita.hora) + '</div>' +
          '<div class="row" style="gap:10px">' + cara(d.f, 28) +
          '<span class="body mute grow">' + esc(d.n) + '</span>' +
          '<span class="cap mute">' + esc(faltan(cita.fecha, cita.hora)) + '</span></div>' +
          '<div class="row" style="gap:8px;flex-wrap:wrap">' + insigniaEnvio(cita) + '</div>' +
          '</button>'
        : '<button class="card tap" data-act="irAgendar" style="gap:14px;text-align:left">' +
          '<div class="row" style="gap:8px"><span class="ct">Tu próxima cita</span><span class="grow"></span>' +
          '<span class="cb s40">' + ic('right', 18) + '</span></div>' +
          '<div class="title">Sin citas por ahora</div>' +
          '<span class="cap mute">Elegí un médico y agendá en dos pasos.</span></button>') +

      // Dos mosaicos
      '<div class="row" style="gap:12px;align-items:stretch">' +
      '<button class="card dark tap" data-act="hoja" data-v="sintomas" style="flex:1;padding:18px;gap:6px;min-height:176px;text-align:left">' +
      '<span class="gridbg"></span>' +
      '<span class="content ct">¿Cómo te sentís?</span>' +
      '<span class="content cap dim">' + (S.sintomas.size
        ? S.sintomas.size + (S.sintomas.size === 1 ? ' síntoma guardado' : ' síntomas guardados')
        : 'Contanos tus síntomas antes de la cita') + '</span>' +
      '<span class="grow"></span>' +
      '<span class="content cb s40 fill" style="color:var(--ink)">' + ic('right', 18) + '</span></button>' +

      '<button class="card tap" data-tab="expediente" style="flex:1;padding:18px;gap:6px;min-height:176px;text-align:left">' +
      '<span class="row" style="gap:8px"><span class="ct">Resultados</span><span class="badge">+2</span></span>' +
      '<span class="cap mute">Tu glucosa salió normal</span>' +
      '<span class="grow"></span>' +
      '<span class="row" style="gap:6px"><span class="bars" style="gap:6px;flex:1">' +
      '<i style="height:26px;flex:1;background:var(--field)"></i>' +
      '<i style="height:36px;flex:1;background:var(--field)"></i>' +
      '<i style="height:48px;flex:1"></i></span>' + simulado('Ejemplo') + '</span></button>' +
      '</div>' +

      // Invitacion a crear cuenta: sugiere, no obliga
      (!u ? '<div class="card soft" style="gap:12px">' +
        '<div class="row" style="gap:10px"><span class="cb s40 brand">' + ic('user', 18) + '</span>' +
        '<div class="grow stack" style="gap:2px"><span class="ct">Creá tu cuenta cuando querás</span>' +
        '<span class="cap mute">Sirve para guardar tus citas, volver a verlas y recibir la confirmación por correo.</span></div></div>' +
        '<div class="row" style="gap:8px">' +
        '<button class="pill h44 darkp tap grow" data-act="irCuenta" data-v="registro" style="justify-content:center">Crear cuenta</button>' +
        '<button class="pill h44 white tap grow" data-act="irCuenta" data-v="sesion" style="justify-content:center">Iniciar sesión</button>' +
        '</div></div>' : '') +

      (!almacenamientoDisponible()
        ? '<div class="card warn" style="gap:8px"><div class="row" style="gap:10px">' +
          '<span style="color:var(--warn)">' + ic('alert', 18) + '</span>' +
          '<span class="bm">Este navegador no puede guardar datos</span></div>' +
          '<span class="cap mute">Puede ser por el modo privado. Vas a poder recorrer la app, pero las citas no se guardarán al recargar.</span></div>'
        : '') +

      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Menu: ajustes y ayuda
   ------------------------------------------------------------ */
vistas.menu = () => {
  const u = usuario();
  const p = perfil();
  const fila = (icono, t, sub, act, v, derecha) =>
    '<button class="li tap" data-act="' + act + '"' + (v !== undefined ? ' data-v="' + esc(v) + '"' : '') +
    ' style="text-align:left"><span class="cb s40 field">' + ic(icono, 18) + '</span>' +
    '<span class="grow stack" style="gap:2px"><span class="bm">' + esc(t) + '</span>' +
    (sub ? '<span class="cap mute">' + esc(sub) + '</span>' : '') + '</span>' +
    (derecha || '<span class="mute">' + ic('chev', 18) + '</span>') + '</button>';
  const sep = '<div class="sep" style="margin:0 12px"></div>';
  const palanca = (t, sub, on, act, v) =>
    '<div class="li"><span class="grow stack" style="gap:2px"><span class="bm">' + esc(t) + '</span>' +
    '<span class="cap mute">' + esc(sub) + '</span></span>' + interruptor(on, act, v, t) + '</div>';

  const rec = p?.recordatorios || { citas: true, medicinas: true, resultados: true };

  return {
    titulo: 'Menú',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Menú', 'Ajustes y ayuda') +

      (u
        ? '<div class="row" style="gap:14px;padding:4px 0">' + caraIniciales(p.nombre, 52) +
          '<div class="grow stack" style="gap:2px"><span class="ct">' + esc(p.nombre) + '</span>' +
          '<span class="cap mute">' + esc(p.correo) + '</span></div></div>'
        : '<div class="card soft" style="gap:10px"><span class="ct">Estás como invitado</span>' +
          '<span class="cap mute">Creá tu cuenta para guardar citas y recibir correos.</span>' +
          boton('Crear cuenta', 'irCuenta', { valor:'registro', clase:'darkp' }) + '</div>') +

      '<div class="card list">' +
      (u ? fila('user', 'Editar mis datos', 'Contacto, datos médicos y emergencia', 'editarPerfil') + sep : '') +
      fila('shield', 'Mis seguros', (u ? u.seguros.length + ' registrados' : 'Necesitás una cuenta'), 'tabPerfil') + sep +
      fila('file', 'Métodos de pago', 'Visa •••• 4417 · simulado', 'hoja', 'pagos') + '</div>' +

      '<div class="card list">' +
      '<div class="li" style="padding-bottom:4px"><span class="ct">Notificaciones</span></div>' +
      palanca('Recordatorio de citas', configurado() ? 'Por correo, antes de tu cita' : 'Automatización sin configurar', rec.citas, 'rec', 'citas') + sep +
      palanca('Recordatorio de medicinas', 'A la hora de cada toma · simulado', rec.medicinas, 'rec', 'medicinas') + sep +
      palanca('Resultados listos', 'Te avisamos apenas salgan · simulado', rec.resultados, 'rec', 'resultados') +
      '</div>' +

      '<div class="card list">' +
      fila('settings', 'Ajustes de la demo', 'Automatización, recordatorio y datos', 'irAjustes') + sep +
      fila('info', 'Ayuda y preguntas', 'Respuestas rápidas', 'hoja', 'ayuda') + sep +
      fila('phone', 'Llamar a la clínica', '2200-1000 · lun a sáb', 'llamar', '2200-1000') + sep +
      fila('shield', 'Privacidad y datos', 'Qué guardamos y dónde', 'hoja', 'privacidad') + sep +
      fila('activity', 'Idioma', '', 'aviso', 'Por ahora solo en español',
           '<span class="label mute">Español</span>') + '</div>' +

      (u ? boton('Cerrar sesión', 'cerrarSesion', { clase:'white tap danger' }) : '') +
      '<p class="cap mute tc" style="margin:0">MediConnect ' + esc(window.__MC_VERSION__ || '3.0') + ' · prototipo académico</p>' +
      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Acciones de estas pantallas
   ------------------------------------------------------------ */
export const acciones = {
  empezar(){
    S.historial = [];
    log('inicio · exploración sin registro');
    tabear('inicio');
  },
  menu(){ ir('menu'); },
  irAgendar(){ S.q = ''; S.chip = 'Todos'; tabear('agendar'); },
  verMedico(v){
    S.medicoId = v;
    S.esControl = false;
    S.fecha = null;
    S.hora = null;
    ir('medico');
  },
  llamar(v){ avisar('Llamando a la clínica · ' + v); },
  tabPerfil(){ tabear('perfil'); }
};
