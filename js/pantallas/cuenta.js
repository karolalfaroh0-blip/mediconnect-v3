/* ============================================================
   MediConnect · pantallas/cuenta.js
   Crear cuenta, iniciar sesion, perfil, edicion y ajustes de la demo.
   ============================================================ */

import { ic, esc, cara, caraIniciales, accion, encabezado, boton, enlace, campo,
         interruptor, monograma, aviso as avisoCaja, simulado } from '../nucleo/ui.js';
import { S, ir, volver, tabear, abrirHoja, cerrarHoja, avisar, repintar, log,
         usuario, perfil, seguros } from '../nucleo/estado.js';
import { registrar, iniciarSesion, cerrarSesion, guardarPerfil, guardarSeguros,
         reglas, edad, primerNombre, criptoFuerte } from '../nucleo/cuenta.js';
import { adoptarCitasDeInvitado, citasDe, resumenAgenda } from '../nucleo/agenda.js';
import { aseguradora, nombreCortoSeguro } from '../nucleo/datos.js';
import { avisarRegistro, baseN8n, guardarBaseN8n, validarBase, probarConexion, configurado } from '../nucleo/automatizacion.js';
import { leerAjustes, guardarAjustes, borrarTodo, almacenamientoDisponible, leer } from '../nucleo/almacen.js';
import { hoy } from '../nucleo/fechas.js';
import { ZONA } from '../nucleo/config.js';

export const vistas = {};

/* ------------------------------------------------------------
   Crear cuenta / iniciar sesion
   ------------------------------------------------------------ */
vistas.cuenta = () => {
  const a = S.auth;
  const esRegistro = a.modo === 'registro';

  const verClave =
    '<button class="tap label mute" data-act="verClave" style="padding:0 2px" ' +
    'aria-label="' + (a.verClave ? 'Ocultar' : 'Mostrar') + ' la contraseña">' +
    (a.verClave ? 'Ocultar' : 'Ver') + '</button>';

  return {
    titulo: esRegistro ? 'Crear cuenta' : 'Iniciar sesión',
    html:
      '<div class="screen"><div class="stack gap24">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +

      encabezado(esRegistro ? 'Tu cuenta' : 'Bienvenido de vuelta',
                 esRegistro ? 'Creá tu cuenta<br>en un minuto' : 'Entrá a<br>tu cuenta') +

      '<p class="body mute" style="margin:0">' +
      (esRegistro
        ? 'Sirve para guardar tus citas, volver a verlas y recibir la confirmación por correo.'
        : 'Usá el correo y la contraseña con los que te registraste en este teléfono.') + '</p>' +

      (a.error ? avisoCaja('danger', '!', 'No pudimos continuar', esc(a.error)) : '') +

      '<div class="card" style="gap:16px">' +
      (esRegistro
        ? campo('f-nombre', 'Nombre completo', a.nombre, {
            error: a.errores.nombre, requerido: true, icono: 'user',
            autocomplete: 'name', ph: 'Ej. Karol Alfaro' })
        : '') +
      campo('f-correo', 'Correo', a.correo, {
        error: a.errores.correo, requerido: true, icono: 'mail', tipo: 'email',
        modo: 'email', autocomplete: 'email', ph: 'tucorreo@gmail.com',
        ayuda: esRegistro ? 'Aquí te llega la confirmación de tus citas.' : '' }) +
      campo('f-clave', 'Contraseña', a.clave, {
        error: a.errores.clave, requerido: true, icono: 'lock',
        tipo: a.verClave ? 'text' : 'password',
        autocomplete: esRegistro ? 'new-password' : 'current-password',
        accionDerecha: verClave,
        ayuda: esRegistro ? 'Mínimo 8 caracteres, con letras y números.' : '' }) +
      '</div>' +

      (esRegistro
        ? '<div class="card p16" style="gap:8px"><div class="row top">' +
          '<span class="mute">' + ic('shield', 18) + '</span>' +
          '<span class="cap mute grow">Tu contraseña no se guarda: se guarda su huella calculada con PBKDF2. ' +
          'Aun así, esta cuenta vive solo en este teléfono y es parte de un prototipo académico, ' +
          'así que no pidas ni guardes información médica real.' +
          (criptoFuerte() ? '' : ' <b>En este navegador el cifrado fuerte no está disponible</b> (suele pasar al abrir el archivo con doble clic en vez de servirlo).') +
          '</span></div></div>'
        : '') +

      '<div class="tc">' +
      enlace(esRegistro ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Creala', 'cambiarModoAuth') +
      '</div>' +

      '</div></div>' +
      accion(a.enviando ? (esRegistro ? 'Creando tu cuenta…' : 'Entrando…')
                        : (esRegistro ? 'Crear mi cuenta' : 'Entrar'),
             'enviarAuth', { estado: a.enviando ? 'cargando' : 'normal' })
  };
};

/* ------------------------------------------------------------
   Perfil
   ------------------------------------------------------------ */
vistas.perfil = () => {
  const u = usuario();

  if (!u){
    return {
      nav: 'perfil',
      titulo: 'Perfil',
      html:
        '<div class="screen"><div class="stack gap24">' +
        encabezado('Perfil', 'Estás como<br>invitado') +
        '<p class="body mute" style="margin:0">Podés recorrer toda la app sin cuenta. ' +
        'La cuenta sirve para guardar tus citas, volver a verlas y recibir la confirmación por correo.</p>' +
        '<div class="card" style="gap:12px">' +
        boton('Crear mi cuenta', 'irCuenta', { valor: 'registro', clase: 'darkp' }) +
        boton('Ya tengo cuenta', 'irCuenta', { valor: 'sesion', clase: 'fieldbg' }) + '</div>' +
        '<div class="card list">' +
        '<button class="li tap" data-act="irAjustes" style="text-align:left">' +
        '<span class="cb s40 field">' + ic('settings', 18) + '</span>' +
        '<span class="grow stack" style="gap:2px"><span class="bm">Ajustes de la demo</span>' +
        '<span class="cap mute">Automatizaciones, recordatorio y datos</span></span>' +
        '<span class="mute">' + ic('chev', 18) + '</span></button></div>' +
        '</div></div>'
    };
  }

  const p = u.perfil;
  const anios = edad(p.nacimiento, hoy());
  const mis = u.seguros || [];
  const resumen = resumenAgenda(u.id);

  const fila = (icono, etiqueta, valor, destino) =>
    '<button class="li tap" data-act="editarPerfil" data-v="' + destino + '" style="text-align:left">' +
    '<span class="cb s40 field">' + ic(icono, 18) + '</span>' +
    '<span class="grow stack" style="gap:2px"><span class="cap mute">' + etiqueta + '</span>' +
    '<span class="bm">' + esc(valor || 'Sin completar') + '</span></span>' +
    '<span class="mute">' + ic('chev', 18) + '</span></button>';
  const sep = '<div class="sep" style="margin:0 12px"></div>';

  return {
    nav: 'perfil',
    titulo: 'Perfil',
    html:
      '<div class="screen"><div class="stack">' +

      '<div class="row" style="gap:16px">' + caraIniciales(p.nombre, 72) +
      '<div class="grow stack" style="gap:4px">' +
      '<h1 class="title" style="margin:0;font-weight:400">' + esc(p.nombre) + '</h1>' +
      '<span class="body mute">' + (anios !== null ? anios + ' años · ' : '') +
      (p.sangre ? 'Sangre ' + esc(p.sangre) : 'Completá tus datos') + '</span></div>' +
      '<button class="pill white tap" data-act="editarPerfil" style="height:36px;padding:0 14px">Editar</button></div>' +

      '<div class="row" style="gap:8px">' +
      [['Citas activas', String(resumen.activas)],
       ['Estatura', p.estatura ? p.estatura + ' m' : '—'],
       ['Alergias', p.alergias || 'Ninguna']
      ].map(x => '<div class="mini"><span class="cap mute">' + x[0] + '</span>' +
        '<span class="bm">' + esc(x[1]) + '</span></div>').join('') + '</div>' +

      // Seguros
      '<div class="card" style="gap:14px">' +
      '<div class="row"><span class="ct grow">Tus seguros</span>' +
      '<button class="cb s36 tap" data-act="hoja" data-v="agregarSeguro" aria-label="Agregar un seguro">' + ic('plus', 18) + '</button></div>' +
      (mis.length
        ? mis.map((s, i) => {
            const x = aseguradora(s.id);
            return (i ? '<div class="sep"></div>' : '') +
              '<button class="row tap" data-act="seguroPrincipal" data-v="' + s.id + '" style="text-align:left">' +
              monograma(x.m, s.principal ? 'bsoft' : 'field') +
              '<span class="grow stack" style="gap:2px"><span class="bm">' + esc(x.n) + ' · ' + esc(s.plan) + '</span>' +
              '<span class="cap mute">Póliza ' + esc(s.poliza) + (s.vigente ? '' : ' · vencida') + '</span></span>' +
              (s.principal ? '<span class="pill sm bsoftp">Principal</span>'
                           : '<span class="cap mute">Hacer principal</span>') + '</button>';
          }).join('')
        : '<span class="body mute">Todavía no agregaste ninguno.</span>') +
      '<span class="cap mute">' + simulado('Validación simulada') + ' En un sistema real, la cobertura se consulta con la aseguradora.</span>' +
      '</div>' +

      // Emergencia
      '<div class="card p16" style="flex-direction:row;align-items:center;gap:12px">' +
      monograma(p.emNombre ? p.emNombre.trim()[0].toUpperCase() : '?', 'warn') +
      '<button class="grow stack tap" data-act="editarPerfil" data-v="emergencia" style="gap:2px;text-align:left">' +
      '<span class="cap mute">En caso de emergencia</span>' +
      '<span class="bm">' + esc(p.emNombre ? p.emNombre + (p.emParentesco ? ' · ' + p.emParentesco : '') : 'Sin completar') + '</span></button>' +
      (p.emTelefono
        ? '<button class="cb s44 brand tap" data-act="llamar" data-v="' + esc(p.emTelefono) + '" aria-label="Llamar al contacto de emergencia">' + ic('phone', 18) + '</button>'
        : '') + '</div>' +

      // Datos de contacto
      '<div class="card list">' +
      fila('phone', 'Teléfono', p.telefono, 'telefono') + sep +
      fila('mail', 'Correo', p.correo, 'correo') + sep +
      fila('pin', 'Dirección', p.direccion, 'direccion') + '</div>' +

      // Accesos
      '<div class="card list">' +
      '<button class="li tap" data-act="irAjustes" style="text-align:left">' +
      '<span class="cb s40 field">' + ic('settings', 18) + '</span>' +
      '<span class="grow stack" style="gap:2px"><span class="bm">Ajustes de la demo</span>' +
      '<span class="cap mute">' + (configurado() ? 'Automatizaciones conectadas' : 'Automatizaciones sin configurar') + '</span></span>' +
      '<span class="mute">' + ic('chev', 18) + '</span></button>' + sep +
      '<button class="li tap" data-act="menu" style="text-align:left">' +
      '<span class="cb s40 field">' + ic('menu', 18) + '</span>' +
      '<span class="grow stack" style="gap:2px"><span class="bm">Menú, ayuda y privacidad</span></span>' +
      '<span class="mute">' + ic('chev', 18) + '</span></button></div>' +

      boton('Cerrar sesión', 'cerrarSesion', { clase: 'white tap danger' }) +
      '</div></div>'
  };
};

/* ------------------------------------------------------------
   Editar el perfil
   ------------------------------------------------------------ */
vistas.editar = () => {
  const d = S.borrador || {};
  const e = S.erroresPerfil || {};
  const sangres = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const parentescos = ['Mamá', 'Papá', 'Pareja', 'Hijo/a', 'Hermano/a', 'Otro'];

  return {
    titulo: 'Editar perfil',
    html:
      '<div class="screen"><div class="stack">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Perfil', 'Editá tus datos') +

      '<div class="card" id="sec-datos" style="gap:16px"><span class="ct">Tus datos</span>' +
      campo('ed-nombre', 'Nombre completo', d.nombre, { error: e.nombre, requerido: true, autocomplete: 'name' }) +
      campo('ed-nacimiento', 'Fecha de nacimiento', d.nacimiento, { error: e.nacimiento, icono: 'calendar', ph: 'dd/mm/aaaa', modo: 'numeric' }) +
      campo('ed-telefono', 'Teléfono', d.telefono, { error: e.telefono, icono: 'phone', modo: 'tel', ph: '0000-0000', autocomplete: 'tel' }) +
      campo('ed-correo', 'Correo', d.correo, { error: e.correo, icono: 'mail', tipo: 'email', modo: 'email', autocomplete: 'email' }) +
      campo('ed-direccion', 'Dirección', d.direccion, { icono: 'pin', autocomplete: 'street-address' }) +
      '</div>' +

      '<div class="card" style="gap:16px"><div class="row" style="gap:8px">' +
      '<span class="ct grow">Datos médicos</span><span class="cap mute">Opcionales</span></div>' +
      '<p class="cap mute" style="margin:0">Esta es una demo académica: no escribas información médica real.</p>' +
      '<div class="stack" style="gap:10px"><span class="label" id="lbl-sangre">Tipo de sangre</span>' +
      '<div class="wrap" role="group" aria-labelledby="lbl-sangre">' +
      sangres.map(b => '<button class="pill h40 tap ' + (d.sangre === b ? 'darkp' : 'fieldbg') + '" ' +
        'data-act="edSangre" data-v="' + b + '" aria-pressed="' + (d.sangre === b) + '" ' +
        'style="min-width:56px;justify-content:center">' + b + '</button>').join('') + '</div></div>' +
      '<div class="row" style="gap:10px;align-items:flex-start">' +
      campo('ed-estatura', 'Estatura', d.estatura, { unidad: 'm', modo: 'decimal' }) +
      campo('ed-peso', 'Peso', d.peso, { unidad: 'kg', modo: 'decimal' }) + '</div>' +
      campo('ed-alergias', 'Alergias', d.alergias, { ph: 'Ej. penicilina' }) +
      campo('ed-condiciones', 'Condiciones', d.condiciones, { ph: 'Ej. asma' }) +
      '</div>' +

      '<div class="card" id="sec-emergencia" style="gap:16px"><span class="ct">Contacto de emergencia</span>' +
      campo('ed-emNombre', 'Nombre', d.emNombre, { error: e.emNombre }) +
      '<div class="stack" style="gap:10px"><span class="label" id="lbl-par">Parentesco</span>' +
      '<div class="wrap" role="group" aria-labelledby="lbl-par">' +
      parentescos.map(r => '<button class="pill h40 tap ' + (d.emParentesco === r ? 'darkp' : 'fieldbg') + '" ' +
        'data-act="edParentesco" data-v="' + r + '" aria-pressed="' + (d.emParentesco === r) + '">' + r + '</button>').join('') +
      '</div></div>' +
      campo('ed-emTelefono', 'Teléfono', d.emTelefono, { error: e.emTelefono, icono: 'phone', modo: 'tel', ph: '0000-0000' }) +
      '</div>' +

      '</div></div>' +
      accion('Guardar cambios', 'guardarPerfil')
  };
};

/* ------------------------------------------------------------
   Ajustes de la demo
   ------------------------------------------------------------ */
vistas.ajustes = () => {
  const aj = S.ajustesBorrador || leerAjustes();
  const base = aj.n8nBase || '';
  const errorBase = base ? validarBase(base) : null;
  const r = S.resultadoConexion;
  const datos = leer();

  return {
    titulo: 'Ajustes de la demo',
    html:
      '<div class="screen"><div class="stack gap24">' +
      '<div class="row"><button class="cb tap" data-act="volver" aria-label="Volver">' + ic('left') + '</button></div>' +
      encabezado('Ajustes', 'Cómo funciona<br>esta demo') +

      // --- n8n ---
      '<div class="card" style="gap:16px">' +
      '<div class="row"><span class="ct grow">Automatizaciones (n8n)</span>' +
      '<span class="pill sm ' + (configurado() ? 'okp' : 'fieldbg') + '">' + (configurado() ? 'Conectado' : 'Apagadas') + '</span></div>' +
      '<p class="cap mute" style="margin:0">Pegá aquí la dirección del webhook de tu n8n personal. ' +
      'Si está vacía, la app funciona igual pero no envía correos.</p>' +
      campo('aj-n8n', 'Dirección del webhook', base, {
        error: errorBase, tipo: 'url', modo: 'url',
        ph: 'https://algo.trycloudflare.com/webhook',
        ayuda: 'No es un secreto: es como la dirección de un formulario.' }) +
      '<div class="row" style="gap:8px">' +
      '<button class="pill h44 darkp tap grow" data-act="probarN8n" style="justify-content:center"' +
      (S.probandoConexion ? ' aria-busy="true"' : '') + '>' +
      (S.probandoConexion ? '<span class="spin"></span>Probando…' : ic('wifi', 16) + 'Probar conexión') + '</button>' +
      '<button class="pill h44 white tap" data-act="borrarN8n">Quitar</button></div>' +
      (r
        ? '<div class="card p16 ' + (r.ok ? 'okc' : 'dangerc') + '" style="gap:6px" role="status">' +
          '<span class="bm">' + (r.ok ? 'Respondió correctamente' : 'No respondió') + '</span>' +
          '<span class="cap mute">' + esc(r.ok ? 'Tu n8n recibió el evento de prueba.' : (r.detalle || '')) + '</span></div>'
        : '') +
      '</div>' +

      // --- recordatorio ---
      '<div class="card" style="gap:16px">' +
      '<span class="ct">Recordatorio</span>' +
      '<p class="cap mute" style="margin:0">Para poder mostrarlo en vivo, el recordatorio se puede pedir ' +
      'con pocos minutos de anticipación en vez de un día antes.</p>' +
      '<div class="wrap" role="group" aria-label="Minutos antes del recordatorio">' +
      [1, 3, 5, 10, 60, 1440].map(m =>
        '<button class="pill h40 tap ' + (aj.recordatorioMinutos === m ? 'darkp' : 'fieldbg') + '" ' +
        'data-act="minutosRecordatorio" data-v="' + m + '" aria-pressed="' + (aj.recordatorioMinutos === m) + '">' +
        (m === 1440 ? '1 día' : m === 60 ? '1 hora' : m + ' min') + '</button>').join('') + '</div>' +
      '</div>' +

      // --- zona horaria ---
      '<div class="card p16" style="gap:8px">' +
      '<div class="row" style="gap:10px"><span class="cb s40 field">' + ic('clock', 18) + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="bm">Zona horaria</span>' +
      '<span class="cap mute">' + esc(ZONA.etiqueta) + ' · se usa en la app, el correo y el calendario</span></div></div></div>' +

      // --- datos guardados ---
      '<div class="card" style="gap:14px">' +
      '<span class="ct">Datos en este teléfono</span>' +
      '<div class="row" style="gap:8px">' +
      [['Cuentas', String(datos.usuarios.length)],
       ['Citas', String(datos.citas.length)],
       ['Guardado', almacenamientoDisponible() ? 'Sí' : 'No']
      ].map(x => '<div class="mini"><span class="cap mute">' + x[0] + '</span>' +
        '<span class="bm">' + x[1] + '</span></div>').join('') + '</div>' +
      '<p class="cap mute" style="margin:0">Todo vive solo en este navegador. Nada se sube a ningún servidor, ' +
      'salvo el aviso que la app le manda a tu n8n para enviar el correo.</p>' +
      boton('Borrar todos los datos de la demo', 'borrarDemo', { clase: 'white tap danger', icono: 'trash' }) +
      '</div>' +

      '</div></div>' +
      accion('Guardar ajustes', 'guardarAjustes')
  };
};

/* ------------------------------------------------------------
   Acciones
   ------------------------------------------------------------ */
export const acciones = {
  irCuenta(v){
    S.auth = { modo: v === 'sesion' ? 'sesion' : 'registro', nombre: '', correo: '', clave: '',
               verClave: false, errores: {}, enviando: false, error: null, destino: S.auth?.destino || null };
    ir('cuenta');
  },

  cambiarModoAuth(){
    S.auth.modo = S.auth.modo === 'registro' ? 'sesion' : 'registro';
    S.auth.errores = {};
    S.auth.error = null;
    repintar();
  },

  verClave(){ S.auth.verClave = !S.auth.verClave; repintar(); },

  async enviarAuth(){
    const a = S.auth;
    if (a.enviando) return;

    a.errores = {};
    a.error = null;
    if (a.modo === 'registro'){
      const e1 = reglas.nombre(a.nombre); if (e1) a.errores.nombre = e1;
    }
    const e2 = reglas.correo(a.correo); if (e2) a.errores.correo = e2;
    if (a.modo === 'registro'){
      const e3 = reglas.clave(a.clave); if (e3) a.errores.clave = e3;
    } else if (!a.clave){
      a.errores.clave = 'Escribí tu contraseña';
    }
    if (Object.keys(a.errores).length){
      avisar('Revisá los datos marcados', 'err');
      repintar();
      return;
    }

    a.enviando = true;
    repintar();

    const r = a.modo === 'registro'
      ? await registrar({ nombre: a.nombre, correo: a.correo, clave: a.clave })
      : await iniciarSesion({ correo: a.correo, clave: a.clave });

    a.enviando = false;

    if (!r.ok){
      a.error = r.error;
      log('cuenta.' + a.modo + '() -> RECHAZADO', 'err');
      repintar();
      return;
    }

    const adopcion = adoptarCitasDeInvitado(r.usuario.id);
    log('cuenta.' + a.modo + '() -> OK · ' + r.usuario.correo +
        (adopcion.adoptadas ? ' · ' + adopcion.adoptadas + ' cita(s) pasaron a su nombre' : ''), 'ok');

    const destino = a.destino;
    S.auth = { modo: 'registro', nombre: '', correo: '', clave: '', verClave: false,
               errores: {}, enviando: false, error: null, destino: null };
    S.seguroElegido = (r.usuario.seguros.find(s => s.principal) || r.usuario.seguros[0] || {}).id || null;

    avisar(a.modo === 'registro' ? '¡Listo! Tu cuenta quedó creada' : 'Bienvenido de vuelta', 'ok');

    S.historial = [];
    ir(destino || 'inicio', { reemplazar: true });

    if (a.modo === 'registro'){
      const res = await avisarRegistro(r.usuario.perfil);
      log('n8n · registro -> ' + (res.ok ? 'correo de bienvenida enviado' : res.estado), res.ok ? 'ok' : 'err');
      repintar();
    }
  },

  cerrarSesion(){
    cerrarSesion();
    log('sesión cerrada · las citas de esta cuenta dejan de verse', 'ok');
    avisar('Cerraste sesión');
    S.historial = [];
    ir('inicio', { reemplazar: true });
  },

  /* --- perfil --- */
  editarPerfil(v){
    const p = perfil();
    if (!p){ acciones.irCuenta('registro'); return; }
    S.borrador = Object.assign({}, p);
    S.erroresPerfil = {};
    S.enfoquePerfil = v || null;
    ir('editar');
  },

  edSangre(v){ S.borrador.sangre = S.borrador.sangre === v ? '' : v; repintar(); },
  edParentesco(v){ S.borrador.emParentesco = v; repintar(); },

  guardarPerfil(){
    const d = S.borrador;
    const e = {};
    const e1 = reglas.nombre(d.nombre); if (e1) e.nombre = e1;
    const e2 = reglas.correo(d.correo); if (e2) e.correo = e2;
    const e3 = reglas.telefono(d.telefono); if (e3) e.telefono = e3;
    const e4 = reglas.fechaNac(d.nacimiento); if (e4) e.nacimiento = e4;
    const e5 = reglas.telefono(d.emTelefono); if (e5) e.emTelefono = e5;

    S.erroresPerfil = e;
    if (Object.keys(e).length){
      avisar('Revisá los datos marcados', 'err');
      repintar();
      return;
    }

    const r = guardarPerfil(d);
    if (!r.ok){ avisar(r.error || 'No se pudo guardar', 'err'); return; }
    S.borrador = null;
    log('perfil guardado', 'ok');
    avisar('Listo, guardamos tus cambios', 'ok');
    volver();
  },

  seguroPrincipal(v){
    const mis = seguros().map(s => Object.assign({}, s, { principal: s.id === v }));
    guardarSeguros(mis);
    S.seguroElegido = v;
    avisar(nombreCortoSeguro(v) + ' es tu seguro principal');
    repintar();
  },

  rec(v){
    const p = perfil();
    if (!p) return;
    const r = Object.assign({}, p.recordatorios);
    r[v] = !r[v];
    guardarPerfil({ recordatorios: r });
    repintar();
  },

  /* --- ajustes --- */
  irAjustes(){
    S.ajustesBorrador = leerAjustes();
    S.resultadoConexion = null;
    ir('ajustes');
  },

  minutosRecordatorio(v){
    S.ajustesBorrador = Object.assign(S.ajustesBorrador || leerAjustes(), { recordatorioMinutos: +v });
    repintar();
  },

  borrarN8n(){
    S.ajustesBorrador = Object.assign(S.ajustesBorrador || leerAjustes(), { n8nBase: '' });
    guardarBaseN8n('');
    S.resultadoConexion = null;
    avisar('Automatizaciones apagadas');
    repintar();
  },

  async probarN8n(){
    const aj = S.ajustesBorrador || leerAjustes();
    const err = validarBase(aj.n8nBase);
    if (err){ avisar(err, 'err'); repintar(); return; }
    guardarBaseN8n(aj.n8nBase);
    S.probandoConexion = true;
    S.resultadoConexion = null;
    repintar();
    const r = await probarConexion();
    S.probandoConexion = false;
    S.resultadoConexion = r;
    log('n8n · prueba de conexión -> ' + (r.ok ? 'OK' : (r.detalle || r.estado)), r.ok ? 'ok' : 'err');
    repintar();
  },

  guardarAjustes(){
    const aj = S.ajustesBorrador || leerAjustes();
    const err = validarBase(aj.n8nBase);
    if (err){ avisar(err, 'err'); repintar(); return; }
    guardarBaseN8n(aj.n8nBase);
    guardarAjustes({ recordatorioMinutos: aj.recordatorioMinutos });
    avisar('Ajustes guardados', 'ok');
    volver();
  },

  borrarDemo(){ abrirHoja('borrarDemo'); },

  confirmarBorrado(){
    borrarTodo();
    log('datos de la demo borrados', 'err');
    location.reload();
  }
};
