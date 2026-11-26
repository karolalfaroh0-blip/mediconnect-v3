/* ============================================================
   MediConnect · pantallas/hojas.js
   Las hojas que suben desde abajo (modales).
   ============================================================ */

import { ic, esc, cara, campo, boton, enlace, accionEnLinea, interruptor,
         monograma, simulado, aviso as avisoCaja } from '../nucleo/ui.js';
import { S, ir, abrirHoja, cerrarHoja, avisar, repintar, log,
         usuario, perfil, seguros } from '../nucleo/estado.js';
import { medico, aseguradoras, aseguradora, nombreCortoSeguro, nombreCon,
         especialidades, sintomasComunes, sintomasMas, examenes, preguntas, medicos } from '../nucleo/datos.js';
import { citaPorId, horariosLibres, diasVisibles } from '../nucleo/agenda.js';
import { fechaLarga, hora12 } from '../nucleo/fechas.js';
import { guardarSeguros } from '../nucleo/cuenta.js';
import { svg as qrSvg } from '../nucleo/qr.js';
import { urlComprobante, configurado, baseN8n } from '../nucleo/automatizacion.js';
import { descargarIcs, urlGoogle, urlOutlook } from '../nucleo/calendario.js';
import { APP, ZONA } from '../nucleo/config.js';

export const hojas = {};

const tapa = (titulo, texto) =>
  '<div class="grab"></div><div class="stack" style="gap:6px">' +
  '<h2 class="title" style="margin:0;font-weight:400">' + titulo + '</h2>' +
  (texto ? '<p class="body mute" style="margin:0">' + texto + '</p>' : '') + '</div>';

const citaActual = () => (S.citaId ? citaPorId(S.citaId) : null);

/* ------------------------------------------------------------
   Sintomas
   ------------------------------------------------------------ */
hojas.sintomas = () => {
  const q = S.sintomaQ.trim().toLowerCase();
  const todos = [...sintomasComunes, ...sintomasMas];
  const lista = q ? todos.filter(s => s.toLowerCase().includes(q))
                  : (S.verMasSintomas ? todos : sintomasComunes);
  const nuevo = q && !todos.some(s => s.toLowerCase() === q);
  const elegidos = [...S.sintomas].filter(s => !lista.includes(s));

  return tapa('¿Cómo te sentís?', 'Elegí lo que sentís. Así tu médico llega preparado.') +
    '<label class="field"><span class="mute">' + ic('search', 18) + '</span>' +
    '<input id="symq" placeholder="Buscá o escribí un síntoma" value="' + esc(S.sintomaQ) + '" ' +
    'autocomplete="off" aria-label="Buscar un síntoma"></label>' +

    '<div class="wrap" role="group" aria-label="Síntomas">' +
    [...elegidos, ...lista].map(s =>
      '<button class="pill h40 tap ' + (S.sintomas.has(s) ? 'darkp' : 'fieldbg') + '" ' +
      'data-act="sintoma" data-v="' + esc(s) + '" aria-pressed="' + S.sintomas.has(s) + '">' + esc(s) + '</button>').join('') +
    (nuevo
      ? '<button class="pill h40 dash tap" data-act="agregarSintoma">' + ic('plus', 16) + 'Agregar “' + esc(S.sintomaQ.trim()) + '”</button>'
      : (!q && !S.verMasSintomas
          ? '<button class="pill h40 dash tap" data-act="masSintomas">' + ic('plus', 16) + 'Ver más</button>' : '')) +
    '</div>' +

    '<div class="stack" style="gap:10px"><span class="label" id="lbl-desde">¿Desde cuándo?</span>' +
    '<div class="wrap" role="group" aria-labelledby="lbl-desde">' +
    ['Hoy', '2–3 días', 'Una semana', 'Más tiempo'].map(x =>
      '<button class="pill h40 tap ' + (S.desde === x ? 'brandp' : 'fieldbg') + '" data-act="desde" data-v="' + x + '" ' +
      'aria-pressed="' + (S.desde === x) + '">' + x + '</button>').join('') + '</div></div>' +

    accionEnLinea(S.sintomas.size ? 'Guardar · ' + S.sintomas.size + (S.sintomas.size === 1 ? ' síntoma' : ' síntomas')
                                  : 'Elegí al menos uno',
                  'guardarSintomas', { estado: S.sintomas.size ? 'normal' : 'off' });
};

/* ------------------------------------------------------------
   Especialidades
   ------------------------------------------------------------ */
hojas.especialista = () => {
  const q = S.especialidadQ.trim().toLowerCase();
  const mis = seguros().filter(s => s.vigente).map(s => s.id);
  const lista = especialidades.filter(s => !q || s[1].toLowerCase().includes(q));

  return tapa('¿Qué especialista buscás?', 'Elegí una especialidad para filtrar la lista.') +
    '<label class="field"><span class="mute">' + ic('search', 18) + '</span>' +
    '<input id="specq" placeholder="Buscá una especialidad" value="' + esc(S.especialidadQ) + '" ' +
    'autocomplete="off" aria-label="Buscar especialidad"></label>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
    lista.map(s => {
      const n = medicos.filter(d => d.chip === s[2] && (!mis.length || d.nets.some(x => mis.includes(x)))).length;
      return '<button class="tap" data-act="especialidad" data-v="' + s[2] + '" ' +
        'style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:22px;background:var(--field);text-align:left">' +
        '<span class="cb s36 ' + (s[3] === 'field' ? 'fill' : s[3]) + '">' + ic(s[0], 18) + '</span>' +
        '<span class="grow stack" style="gap:1px"><span class="label">' + s[1] + '</span>' +
        '<span class="cap mute">' + (n ? n + ' cerca' : 'Pronto') + '</span></span></button>';
    }).join('') + '</div>' +
    (lista.length ? '' : '<p class="body mute empty">No encontramos esa especialidad.</p>');
};

/* ------------------------------------------------------------
   Elegir seguro
   ------------------------------------------------------------ */
hojas.elegirSeguro = () => {
  const d = medico(S.medicoId);
  const mis = seguros();
  return tapa('¿Con qué seguro?', 'Elegí cómo querés pagar esta cita.') +
    '<div class="stack" style="gap:10px" role="radiogroup" aria-label="Seguro para esta cita">' +
    mis.map(s => {
      const x = aseguradora(s.id);
      const ok = s.vigente && d.nets.includes(s.id);
      return '<button class="card p16 opt tap' + (S.seguroElegido === s.id ? ' on' : '') + '" ' +
        'data-act="elegirSeguro" data-v="' + s.id + '" role="radio" aria-checked="' + (S.seguroElegido === s.id) + '" ' +
        'style="flex-direction:row;align-items:center;gap:12px;background:var(--field);border-radius:24px;text-align:left">' +
        monograma(x.m, ok ? 'ok' : 'warn', 40) +
        '<span class="grow stack" style="gap:2px"><span class="bm">' + esc(x.n) + ' · ' + esc(s.plan) + '</span>' +
        '<span class="cap mute">' + (ok ? 'Cubre esta cita' : s.vigente ? 'Este médico no lo acepta' : 'Póliza ' + esc(s.poliza) + ' vencida') + '</span></span>' +
        '<span class="radio' + (S.seguroElegido === s.id ? ' on' : '') + '"></span></button>';
    }).join('') +
    '<button class="card p16 opt tap' + (S.seguroElegido === null ? ' on' : '') + '" data-act="elegirSeguro" data-v="" ' +
    'role="radio" aria-checked="' + (S.seguroElegido === null) + '" ' +
    'style="flex-direction:row;align-items:center;gap:12px;background:var(--field);border-radius:24px;text-align:left">' +
    monograma('$', 'fill', 40) +
    '<span class="grow stack" style="gap:2px"><span class="bm">Sin seguro</span>' +
    '<span class="cap mute">Pagás $' + d.price + ' en línea o en la clínica</span></span>' +
    '<span class="radio' + (S.seguroElegido === null ? ' on' : '') + '"></span></button></div>';
};

/* ------------------------------------------------------------
   Agregar un seguro
   ------------------------------------------------------------ */
hojas.agregarSeguro = () => {
  const a = S.agregarSeguro;
  const q = a.q.trim().toLowerCase();
  const tengo = seguros().map(i => i.id);
  const lista = aseguradoras.filter(i => !tengo.includes(i.id) && (!q || i.n.toLowerCase().includes(q)));
  const listo = a.id && a.poliza.trim().length >= 4;

  return tapa('Agregá tu seguro', 'Con tu póliza validamos la cobertura antes de cada cita.') +
    '<div class="stack" style="gap:8px"><span class="label">Aseguradora</span>' +
    '<label class="field"><span class="mute">' + ic('search', 18) + '</span>' +
    '<input id="insq" placeholder="Buscá tu aseguradora" value="' + esc(a.q) + '" autocomplete="off" ' +
    'aria-label="Buscar aseguradora"></label></div>' +

    '<div class="stack" style="gap:0">' +
    (lista.length
      ? lista.slice(0, 5).map(i =>
          '<button class="row tap" data-act="elegirAseguradora" data-v="' + i.id + '" style="padding:8px 0;text-align:left" ' +
          'aria-pressed="' + (a.id === i.id) + '">' +
          monograma(i.m, a.id === i.id ? 'bsoft' : 'field', 36) +
          '<span class="bm grow">' + esc(i.n) + '</span>' +
          (a.id === i.id ? '<span class="cb s28 brand">' + ic('check', 16) + '</span>' : '') + '</button>').join('')
      : '<p class="body mute" style="padding:8px 0;margin:0">No la encontramos. Revisá el nombre.</p>') + '</div>' +

    campo('insp', 'Número de póliza', a.poliza, { ph: 'Ej. 12-345678', ayuda: 'Mínimo 4 caracteres.' }) +

    '<div class="stack" style="gap:10px"><span class="label" id="lbl-plan">Tipo de plan</span>' +
    '<div class="wrap" role="group" aria-labelledby="lbl-plan">' +
    ['Individual', 'Familiar', 'Colectivo'].map(p =>
      '<button class="pill h40 tap ' + (a.plan === p ? 'darkp' : 'fieldbg') + '" data-act="planSeguro" data-v="' + p + '" ' +
      'aria-pressed="' + (a.plan === p) + '">' + p + '</button>').join('') + '</div></div>' +

    '<div class="row"><span class="body grow">Usarlo como seguro principal</span>' +
    interruptor(a.principal, 'seguroComoPrincipal', undefined, 'Usarlo como seguro principal') + '</div>' +

    accionEnLinea('Guardar seguro', 'guardarSeguro', { estado: listo ? 'normal' : 'off' });
};

/* ------------------------------------------------------------
   Guardar la cita: cuenta o invitado
   ------------------------------------------------------------ */
hojas.guardarCita = () =>
  tapa('¿Cómo guardamos tu cita?', 'La cuenta sirve para volver a verla desde este teléfono y recibir la confirmación por correo.') +
  '<div class="stack" style="gap:10px">' +
  boton('Crear mi cuenta', 'authDesdeCita', { valor: 'registro', clase: 'darkp' }) +
  boton('Ya tengo cuenta', 'authDesdeCita', { valor: 'sesion', clase: 'fieldbg' }) +
  '</div>' +
  '<div class="card p16" style="gap:8px"><div class="row top">' +
  '<span class="mute">' + ic('info', 18) + '</span>' +
  '<span class="cap mute grow">Si seguís como invitado, la cita se guarda igual en este teléfono, ' +
  'pero no te llega correo. Después podés crear tu cuenta y la pasamos a tu nombre.</span></div></div>' +
  enlace('Continuar como invitado', 'continuarInvitado');

/* ------------------------------------------------------------
   Cambiar o cancelar
   ------------------------------------------------------------ */
hojas.cambiar = () => {
  const cita = citaActual();
  if (!cita) return tapa('Cita no encontrada', '');
  const d = medico(cita.medicoId);
  return tapa('¿Qué querés hacer con tu cita?',
              fechaLarga(cita.fecha) + ', ' + hora12(cita.hora) + ', con ' + nombreCon(d) + '.') +
    '<div class="stack" style="gap:0">' +
    accionEnLinea('Cambiar fecha u hora', 'irReprogramar') +
    enlace('Cancelar cita', 'hoja', { rojo: true, valor: 'cancelar' }) +
    enlace('Volver', 'cerrarHoja') + '</div>';
};

hojas.cancelar = () => {
  const cita = citaActual();
  if (!cita) return tapa('Cita no encontrada', '');
  const d = medico(cita.medicoId);
  return tapa('¿Cancelar tu cita?',
    'Vas a liberar tu horario del ' + fechaLarga(cita.fecha).toLowerCase() + ' a las ' + hora12(cita.hora) +
    ' con ' + nombreCon(d) + '. No hay cargo por cancelar y el horario queda disponible para otra persona.') +
    '<div class="stack" style="gap:0">' +
    accionEnLinea('No, mantener mi cita', 'cerrarHoja') +
    enlace('Sí, cancelar cita', 'cancelarCita', { rojo: true }) + '</div>';
};

/* ------------------------------------------------------------
   Calendario
   ------------------------------------------------------------ */
hojas.calendario = () => {
  const cita = citaActual();
  if (!cita) return tapa('Cita no encontrada', '');
  const d = medico(cita.medicoId);
  return tapa('Agregar al calendario',
    d.n + ' · ' + fechaLarga(cita.fecha) + ', ' + hora12(cita.hora) + ' (' + ZONA.etiqueta + ').') +
    '<div class="stack" style="gap:10px">' +
    boton('Descargar el archivo .ics', 'descargarIcs', { clase: 'darkp', icono: 'download' }) +
    boton('Abrir en Google Calendar', 'abrirGoogle', { clase: 'fieldbg', icono: 'calendar' }) +
    boton('Abrir en Outlook', 'abrirOutlook', { clase: 'fieldbg', icono: 'calendar' }) +
    '</div>' +
    '<div class="card p16" style="gap:8px"><div class="row top">' +
    '<span class="mute">' + ic('info', 18) + '</span>' +
    '<span class="cap mute grow">La app no puede agregar el evento sola a tu calendario personal: ' +
    'eso lo tenés que confirmar vos. Por eso te damos el archivo o el enlace y vos decidís si lo guardás.</span></div></div>';
};

/* ------------------------------------------------------------
   QR ampliado
   ------------------------------------------------------------ */
hojas.qr = () => {
  const cita = citaActual();
  if (!cita) return tapa('Cita no encontrada', '');
  const url = urlComprobante(cita);
  return tapa('Tu pase de llegada', 'Mostrá este código en recepción. Abre el comprobante de la cita ' + cita.codigo + '.') +
    '<div style="display:flex;justify-content:center">' +
    '<span class="qr-caja" style="padding:16px">' +
    qrSvg(url, { tamano: 240, titulo: 'Código QR de la cita ' + cita.codigo }) + '</span></div>' +
    '<div class="tc"><span class="pill fieldbg">' + esc(cita.codigo) + '</span></div>' +
    '<p class="cap mute tc" style="margin:0;word-break:break-all">' + esc(url) + '</p>' +
    '<div class="card p16" style="gap:8px"><div class="row top">' +
    '<span class="mute">' + ic('shield', 18) + '</span>' +
    '<span class="cap mute grow">El código no lleva contraseñas ni datos médicos: solo el código de la cita. ' +
    'El comprobante solo muestra los datos completos en el teléfono donde se reservó.</span></div></div>';
};

/* ------------------------------------------------------------
   Examen del expediente
   ------------------------------------------------------------ */
hojas.examen = () => {
  const e = examenes[S.examenId];
  if (!e) return tapa('Examen no encontrado', '');
  const enviado = S.enviados[S.examenId];
  const elegido = S.enviarA;
  const mios = ['her', 'tak', 'riv', 'pen'];

  return '<div class="grab"></div>' +
    '<div class="row top"><div class="grow stack" style="gap:6px">' +
    '<h2 class="title" style="margin:0;font-weight:400">' + esc(e.n) + '</h2>' +
    '<span class="row" style="gap:8px"><span class="pill sm ' + e.cls + '">' + e.st + '</span>' +
    '<span class="cap mute">' + esc(e.date) + '</span></span></div>' +
    '<button class="cb s40 field tap" data-act="cerrarHoja" aria-label="Cerrar">' + ic('close', 18) + '</button></div>' +

    '<div class="card p16" style="background:var(--field);gap:12px">' +
    '<div class="row"><span class="cb s40 fill">' + ic('flask', 18) + '</span>' +
    '<div class="grow stack" style="gap:2px"><span class="bm">' + esc(e.lab) + '</span>' +
    '<span class="cap mute">' + esc(e.branch) + '</span></div></div>' +
    '<div class="cap mute">Ordenado por ' + esc(medico(e.by).n) + ' · ' + esc(e.note) + '</div></div>' +

    '<div class="stack" style="gap:0">' + e.rows.map(r =>
      '<div class="res"><span class="bm">' + esc(r[0]) + '</span>' +
      '<span class="v' + (r[4] ? ' hi' : '') + '">' + esc(r[1]) + ' <span class="cap mute">' + esc(r[2]) + '</span></span>' +
      '<span class="r">' + esc(r[3]) + (r[4] ? ' · <b style="color:var(--warn);font-weight:600">un poco alto</b>' : '') + '</span></div>'
    ).join('') + '</div>' +

    (enviado
      ? '<div class="card p16 soft" style="flex-direction:row;align-items:center;gap:12px">' +
        '<span class="cb s40 brand">' + ic('check', 18) + '</span>' +
        '<div class="grow stack" style="gap:2px"><span class="bm">Enviado a ' + esc(medico(enviado).n) + '</span>' +
        '<span class="cap mute">' + 'Simulado: no sale ningún dato de este teléfono' + '</span></div>' +
        '<button class="pill sm white tap" data-act="reenviarExamen">Cambiar</button></div>'
      : '<div class="stack" style="gap:12px"><div class="row" style="gap:8px">' +
        '<span class="ct grow">Enviáselo a tu médico</span>' + simulado('Simulado') + '</div>' +
        '<div class="chips" style="gap:6px">' + mios.map(id => {
          const d = medico(id);
          return '<button class="docpick tap' + (elegido === id ? ' on' : '') + '" data-act="enviarA" data-v="' + id + '" ' +
            'aria-pressed="' + (elegido === id) + '">' + cara(d.f, 48) +
            '<span class="label">' + esc(d.short) + '</span>' +
            '<span class="cap mute" style="font-size:11px">' + esc(d.tag) + '</span></button>';
        }).join('') + '</div>' +
        '<label class="field"><input id="sendnote" placeholder="Agregá una nota (opcional)" ' +
        'value="' + esc(S.notaEnvio) + '" autocomplete="off" aria-label="Nota para el médico"></label>' +
        accionEnLinea(elegido ? 'Enviar a ' + medico(elegido).n : 'Elegí un médico', 'enviarExamen',
                      { estado: elegido ? 'normal' : 'off' }) + '</div>');
};

/* ------------------------------------------------------------
   Ayuda, privacidad, pagos
   ------------------------------------------------------------ */
hojas.ayuda = () =>
  tapa('¿En qué te ayudamos?', 'Las dudas más comunes, resueltas.') +
  '<div class="stack" style="gap:0">' + preguntas.map((f, i) =>
    '<button class="faq tap" data-act="pregunta" data-v="' + i + '" style="text-align:left;display:block" ' +
    'aria-expanded="' + (S.pregunta === i) + '">' +
    '<span class="row"><span class="bm grow">' + esc(f[0]) + '</span>' +
    '<span class="mute" style="transform:rotate(' + (S.pregunta === i ? 90 : 0) + 'deg);transition:transform .2s">' +
    ic('chev', 18) + '</span></span>' +
    (S.pregunta === i ? '<span class="body mute" style="display:block;margin-top:8px">' + esc(f[1]) + '</span>' : '') +
    '</button>').join('') + '</div>' +
  '<div class="row" style="gap:10px">' +
  '<button class="pill h52 darkp tap grow" data-act="llamar" data-v="' + APP.clinica.telefono + '" style="justify-content:center">' +
  ic('phone', 18) + 'Llamar a la clínica</button></div>';

hojas.privacidad = () =>
  tapa('Privacidad y datos', 'Qué guardamos, dónde y qué sale de este teléfono.') +
  '<div class="stack" style="gap:14px">' +
  [['Dónde se guardan tus datos',
    'En el almacenamiento de este navegador. No hay servidor ni base de datos en la nube: si borrás los datos del sitio, desaparecen.'],
   ['Qué sale de este teléfono',
    configurado()
      ? 'Solo el aviso que la app le manda a tu n8n para enviar el correo: tu nombre, tu correo y los datos de la cita. Nada médico.'
      : 'Nada. Las automatizaciones todavía no están conectadas, así que la app no envía nada a ningún lado.'],
   ['Qué NO pedimos',
    'No pedimos documento de identidad, número de tarjeta real ni información médica sensible. Los pagos y los resultados son simulados.'],
   ['Tu contraseña',
    'No se guarda. Se guarda una huella calculada con PBKDF2 y una sal única. Aun así, es una cuenta de demostración.']
  ].map(([t, d], i) => (i ? '<div class="sep"></div>' : '') +
    '<div class="stack" style="gap:4px"><span class="bm">' + t + '</span>' +
    '<span class="cap mute">' + d + '</span></div>').join('') + '</div>' +
  boton('Borrar todos mis datos', 'borrarDemo', { clase: 'white tap danger', icono: 'trash' });

hojas.pagos = () =>
  tapa('Métodos de pago', 'Para consultas que no cubre tu seguro.') +
  '<div class="row" style="gap:8px">' + simulado('Todo simulado') + '</div>' +
  '<div class="card p16" style="background:var(--field);flex-direction:row;align-items:center;gap:12px">' +
  monograma('VISA', 'bsoft', 40) +
  '<div class="grow stack" style="gap:2px"><span class="bm">Visa •••• 4417</span>' +
  '<span class="cap mute">Vence 08/29 · tarjeta ficticia</span></div>' +
  '<span class="pill sm bsoftp">Principal</span></div>' +
  '<div class="card p16" style="gap:8px"><div class="row top">' +
  '<span class="mute">' + ic('shield', 18) + '</span>' +
  '<span class="cap mute grow">Esta demo nunca pide ni guarda números de tarjeta reales. ' +
  'En un sistema de verdad, el cobro lo haría una pasarela de pago certificada.</span></div></div>';

/* ------------------------------------------------------------
   Confirmar el borrado de la demo
   ------------------------------------------------------------ */
hojas.borrarDemo = () =>
  tapa('¿Borrar todos los datos?',
    'Se van a borrar las cuentas, las citas y los ajustes guardados en este teléfono. No se puede deshacer.') +
  '<div class="stack" style="gap:0">' +
  accionEnLinea('No, mantener mis datos', 'cerrarHoja') +
  enlace('Sí, borrar todo', 'confirmarBorrado', { rojo: true }) + '</div>';

/* ------------------------------------------------------------
   Acciones de las hojas
   ------------------------------------------------------------ */
export const acciones = {
  hoja(v){ abrirHoja(v); },
  cerrarHoja(){ cerrarHoja(); },

  /* --- sintomas --- */
  sintoma(v){
    if (S.sintomas.has(v)) S.sintomas.delete(v); else S.sintomas.add(v);
    repintar();
  },
  masSintomas(){ S.verMasSintomas = true; repintar(); },
  agregarSintoma(){
    const s = S.sintomaQ.trim();
    if (!s) return;
    S.sintomas.add(s.charAt(0).toUpperCase() + s.slice(1));
    S.sintomaQ = '';
    repintar();
  },
  desde(v){ S.desde = v; repintar(); },
  guardarSintomas(){
    log('motivo = [' + [...S.sintomas].join(', ') + '] desde ' + S.desde);
    cerrarHoja();
    avisar('Guardado. Tu médico lo verá en la cita', 'ok');
  },

  /* --- especialidades --- */
  especialidad(v){
    S.chip = v;
    cerrarHoja();
    if (S.pantalla !== 'agendar') ir('agendar', { reemplazar: S.pantalla === 'agendar' });
    else repintar();
  },

  /* --- seguros --- */
  elegirSeguro(v){
    S.seguroElegido = v || null;
    S.demo.seguro = 'vigente';          // al elegir a mano se deja de forzar el escenario
    cerrarHoja();
  },
  elegirAseguradora(v){ S.agregarSeguro.id = v; repintar(); },
  planSeguro(v){ S.agregarSeguro.plan = v; repintar(); },
  seguroComoPrincipal(){ S.agregarSeguro.principal = !S.agregarSeguro.principal; repintar(); },
  guardarSeguro(){
    const a = S.agregarSeguro;
    if (!a.id || a.poliza.trim().length < 4) return;
    const mis = seguros().map(s => Object.assign({}, s, { principal: a.principal ? false : s.principal }));
    mis.push({ id: a.id, plan: a.plan, poliza: a.poliza.trim(), principal: a.principal, vigente: true });
    guardarSeguros(mis);
    S.agregarSeguro = { q: '', id: null, poliza: '', plan: 'Familiar', principal: false };
    cerrarHoja();
    avisar(nombreCortoSeguro(mis[mis.length - 1].id) + ' agregado', 'ok');
  },

  /* --- guardar la cita --- */
  authDesdeCita(v){
    S.auth = { modo: v === 'sesion' ? 'sesion' : 'registro', nombre: '', correo: '', clave: '',
               verClave: false, errores: {}, enviando: false, error: null, destino: 'confirmar' };
    cerrarHoja();
    ir('cuenta');
  },
  continuarInvitado(){
    cerrarHoja();
    log('el paciente sigue como invitado · la cita se guarda sin cuenta');
    import('./agendar.js').then(m => {
      const ev = m.evaluarSeguro(medico(S.medicoId));
      m.guardarCita({ modoPago: ev.estado === 'cubre' ? 'seguro' : 'clinica' });
    });
  },

  /* --- calendario --- */
  descargarIcs(){
    const cita = citaActual();
    if (!cita) return;
    const r = descargarIcs(cita, { urlComprobante: urlComprobante(cita) });
    log('calendario · archivo .ics generado para ' + cita.codigo, 'ok');
    cerrarHoja();
    avisar(r === 'descargado'
      ? 'Descargamos el archivo .ics: abrilo para agregarlo'
      : 'Abrimos el archivo .ics en otra pestaña');
  },
  abrirGoogle(){
    const cita = citaActual();
    if (!cita) return;
    window.open(urlGoogle(cita, { urlComprobante: urlComprobante(cita) }), '_blank', 'noopener');
    cerrarHoja();
    avisar('Abrimos Google Calendar: confirmá para guardarlo');
  },
  abrirOutlook(){
    const cita = citaActual();
    if (!cita) return;
    window.open(urlOutlook(cita, { urlComprobante: urlComprobante(cita) }), '_blank', 'noopener');
    cerrarHoja();
    avisar('Abrimos Outlook: confirmá para guardarlo');
  },

  /* --- examenes --- */
  enviarA(v){ S.enviarA = v; repintar(); },
  enviarExamen(){
    if (!S.enviarA) return;
    S.enviados[S.examenId] = S.enviarA;
    avisar('Enviado a ' + medico(S.enviarA).n + ' (simulado)', 'ok');
    repintar();
  },
  reenviarExamen(){ delete S.enviados[S.examenId]; S.enviarA = null; repintar(); },

  /* --- ayuda --- */
  pregunta(v){ S.pregunta = S.pregunta === +v ? -1 : +v; repintar(); }
};
