/* ============================================================
   MediConnect · ui.js
   Piezas de interfaz que se repiten en muchas pantallas.
   Todo son funciones que devuelven texto HTML: faciles de leer,
   faciles de probar y sin dependencias.
   ============================================================ */

import { FOTOS } from './fotos.js';

/** Escapa lo que escribe la persona, para que nunca se interprete como HTML */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

export const $ = (sel, raiz) => (raiz || document).querySelector(sel);
export const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

/* ------------------------------------------------------------
   Iconos (el mismo juego del prototipo original, mas algunos nuevos)
   ------------------------------------------------------------ */
const TRAZOS = {
  home:'<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  file:'<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  menu:'<path d="M5 8h14M5 12h14M5 16h14"/>',
  plus:'<path d="M12 5.5v13M5.5 12h13"/>',
  minus:'<path d="M5.5 12h13"/>',
  right:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  left:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chev:'<path d="m9.5 6 6 6-6 6"/>',
  chevDown:'<path d="m6 9.5 6 6 6-6"/>',
  bell:'<path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6 2.5 8 2.5 8H4s2.5-2 2.5-8"/><path d="M10 20.5h4"/>',
  shield:'<path d="M12 3.5 5 6.2V12c0 4.3 3 7.4 7 8.5 4-1.1 7-4.2 7-8.5V6.2z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  pin:'<path d="M12 21s6.5-5.8 6.5-11.5a6.5 6.5 0 0 0-13 0C5.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  phone:'<path d="M6 4h3l1.7 4.3-2.2 1.4a10.5 10.5 0 0 0 5.8 5.8l1.4-2.2L20 15v3a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2"/>',
  pill:'<path d="M10.2 20.3a4.9 4.9 0 0 1-6.9-6.9l6.4-6.4a4.9 4.9 0 0 1 6.9 6.9z"/><path d="m8.5 8.5 7 7"/>',
  activity:'<path d="M3 12h4l2.5-6.5 5 13L17 12h4"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  flask:'<path d="M9 3.5h6M10 3.5v5.5L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9V3.5"/><path d="M7 15h10"/>',
  thermo:'<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/>',
  navigate:'<path d="m4 11 16-7-7 16-2-7z"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  baby:'<circle cx="12" cy="9" r="5"/><path d="M10 9h.01M14 9h.01M10.5 11.2c.8.6 2.2.6 3 0M7 20c1.2-2.5 2.9-3.7 5-3.7s3.8 1.2 5 3.7"/>',
  bone:'<path d="M7 17 17 7M5.5 15.5a2 2 0 1 0 3 3M15.5 5.5a2 2 0 1 1 3 3M5.5 15.5a2 2 0 1 1-1.5-3.4M18.5 8.5a2 2 0 1 0 1.5 3.4"/>',
  heart:'<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  mail:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.6 7 7.4 5.4a1.7 1.7 0 0 0 2 0L20.4 7"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3.5M15.5 12v2.5"/>',
  qr:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M13.5 13.5h3v3h-3zM20.5 13.5v3M17.5 20.5h3M13.5 20.5h1"/>',
  download:'<path d="M12 3.5v11M8 11l4 4 4-4M4.5 19.5h15"/>',
  edit:'<path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4z"/>',
  logout:'<path d="M15 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M11 16l4-4-4-4M15 12H4"/>',
  info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  alert:'<path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4M12 17h.01"/>',
  share:'<circle cx="17.5" cy="6" r="2.8"/><circle cx="6.5" cy="12" r="2.8"/><circle cx="17.5" cy="18" r="2.8"/><path d="m9 10.7 6-3.4M9 13.3l6 3.4"/>',
  trash:'<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10v6M14 10v6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 7.2l1.9 1.1M17.9 15.7l1.9 1.1M4.2 16.8l1.9-1.1M17.9 8.3l1.9-1.1"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-.8 4.5"/><path d="M20.5 4.5V11H14"/>',
  wifi:'<path d="M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 16.4a3.5 3.5 0 0 1 4 0M12 20h.01"/>',
  star:'FILL'
};

export function ic(clave, tamano = 20){
  if (clave === 'star'){
    return '<svg class="ico" width="' + tamano + '" height="' + tamano + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="m12 3.6 2.5 5.3 5.8.8-4.2 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.2-4 5.8-.8z"/></svg>';
  }
  const t = TRAZOS[clave] || TRAZOS.info;
  return '<svg class="ico" width="' + tamano + '" height="' + tamano + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t + '</svg>';
}

/* ------------------------------------------------------------
   Avatares ilustrados (los mismos del prototipo original)
   ------------------------------------------------------------ */
export function cara(o, tamano){
  if (o && o.photo && FOTOS[o.photo]){
    return '<span class="av" style="width:' + tamano + 'px;height:' + tamano + 'px">' +
      '<img src="' + FOTOS[o.photo] + '" width="' + tamano + '" height="' + tamano + '" alt="" ' +
      'style="display:block;width:100%;height:100%;object-fit:cover"></span>';
  }
  o = o || { bg:'#E4E9FF', skin:'#D9A57E', hc:'#2A1C14', hair:'short', shirt:'#111214' };
  const atras = o.hair === 'long'
    ? '<path d="M15 26c0-9 5.8-14 13-14s13 5 13 14v14c-3-1-5-6-5-12H20c0 6-2 11-5 12z" fill="' + o.hc + '"/>' : '';
  const arriba = o.hair === 'bald' ? '' : o.hair === 'bun'
    ? '<circle cx="28" cy="10.5" r="4.5" fill="' + o.hc + '"/><path d="M17.5 24c0-7 4.7-11 10.5-11s10.5 4 10.5 11c-3-4-6.5-5.5-10.5-5.5S20.5 20 17.5 24z" fill="' + o.hc + '"/>'
    : '<path d="M17.5 24c0-7 4.7-11.5 10.5-11.5S38.5 17 38.5 24c-2.5-3.5-6-5.5-10.5-5.5S20 20.5 17.5 24z" fill="' + o.hc + '"/>';
  return '<span class="av" style="width:' + tamano + 'px;height:' + tamano + 'px">' +
    '<svg width="' + tamano + '" height="' + tamano + '" viewBox="0 0 56 56" aria-hidden="true">' +
    '<rect width="56" height="56" fill="' + o.bg + '"/>' + atras +
    '<path d="M9 56c0-11 8.5-17 19-17s19 6 19 17z" fill="' + o.shirt + '"/>' +
    (o.coat ? '<path d="M24 39.5l4 7 4-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>' : '') +
    '<rect x="24.5" y="32" width="7" height="8" rx="3" fill="' + o.skin + '"/>' +
    '<circle cx="28" cy="25" r="10.5" fill="' + o.skin + '"/>' + arriba +
    (o.glasses ? '<g fill="none" stroke="#111214" stroke-width="1.4"><circle cx="24" cy="26" r="3"/><circle cx="32" cy="26" r="3"/><path d="M27 26h2"/></g>' : '') +
    '</svg></span>';
}

/** Avatar con iniciales, para quien todavia no tiene foto */
export function caraIniciales(nombre, tamano, clase){
  const txt = (nombre || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  return '<span class="cb ' + (clase || 'bsoft') + '" style="width:' + tamano + 'px;height:' + tamano + 'px;' +
    'font-size:' + Math.round(tamano * 0.36) + 'px;font-weight:600;border:0">' + esc(txt) + '</span>';
}

/* ------------------------------------------------------------
   Piezas sueltas
   ------------------------------------------------------------ */
export const barraEstado = (clara) =>
  '<div class="status' + (clara ? ' light' : '') + '" aria-hidden="true"><span>9:41</span>' +
  '<svg width="68" height="13" viewBox="0 0 68 13"><g fill="currentColor">' +
  '<rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/>' +
  '<rect x="10" y="3.5" width="3" height="8.5" rx="1"/><rect x="15" y="1" width="3" height="11" rx="1"/>' +
  '<path d="M30.5 3.2a9.5 9.5 0 0 1 12.9 0l-1.3 1.4a7.6 7.6 0 0 0-10.3 0zM33 5.9a6 6 0 0 1 7.9 0l-1.3 1.4a4.1 4.1 0 0 0-5.3 0zM35.6 8.6a2.3 2.3 0 0 1 2.8 0L37 10.1z"/>' +
  '<rect x="47.5" y="1" width="18" height="10" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4"/>' +
  '<rect x="49.5" y="3" width="14" height="6" rx="1.5"/></g></svg></div>';

export const navegacion = (activa, avisos) =>
  '<nav class="nav" aria-label="Secciones principales">' +
  [['inicio','home','Inicio'], ['citas','calendar','Citas'], ['expediente','file','Expediente'], ['perfil','user','Perfil']]
    .map(([s, i, l]) =>
      '<button class="' + (s === activa ? 'on' : '') + '" data-tab="' + s + '" aria-label="' + l + '"' +
      (s === activa ? ' aria-current="page"' : '') + '>' + ic(i, 22) +
      (avisos && avisos[s] ? '<span class="pt"></span>' : '') + '</button>').join('') +
  '</nav>';

/** Barra de accion principal. `estado` puede ser 'normal' | 'off' | 'cargando' */
export function accion(texto, act, { estado = 'normal', valor, clase = '' } = {}){
  const apagado = estado === 'off';
  const cargando = estado === 'cargando';
  const fija = !clase.includes('inline-action');
  return '<button class="action ' + clase + (apagado ? ' off' : '') + (cargando ? ' cargando' : '') + '"' +
    (fija ? ' data-fija="1"' : '') +
    ' data-act="' + act + '"' + (valor !== undefined ? ' data-v="' + esc(valor) + '"' : '') +
    (apagado ? ' aria-disabled="true"' : '') + (cargando ? ' aria-busy="true"' : '') + '>' +
    (cargando ? '<span class="spin"></span>' : '') +
    '<span class="t">' + esc(texto) + '</span></button>';
}

export const accionEnLinea = (texto, act, opciones) =>
  accion(texto, act, Object.assign({}, opciones, { clase: 'inline-action ' + (opciones?.clase || '') }));

export const botonVolver = (etiqueta) =>
  '<div class="row"><button class="cb tap" data-act="volver" aria-label="' + (etiqueta || 'Volver') + '">' + ic('left') + '</button></div>';

/** Encabezado de pantalla: una linea pequena y un titulo grande */
export const encabezado = (pequeno, grande) =>
  '<div class="stack" style="gap:6px"><p class="body mute" style="margin:0">' + pequeno + '</p>' +
  '<h1 class="hero" style="margin:0;font-weight:400">' + grande + '</h1></div>';

export const interruptor = (encendido, act, valor, etiqueta) =>
  '<button class="sw' + (encendido ? ' on' : '') + '" data-act="' + act + '"' +
  (valor !== undefined ? ' data-v="' + esc(valor) + '"' : '') +
  ' role="switch" aria-checked="' + !!encendido + '"' +
  (etiqueta ? ' aria-label="' + esc(etiqueta) + '"' : '') + '></button>';

export const monograma = (texto, clase, tamano) =>
  '<span class="cb ' + (clase || 'field') + '" style="width:' + (tamano || 44) + 'px;height:' + (tamano || 44) +
  'px;font-size:11px;font-weight:600;border:0">' + esc(texto) + '</span>';

export const manchas = (lista) => lista.map(b =>
  '<span class="blob" style="background:' + b[0] + ';width:' + b[1] + 'px;height:' + b[1] + 'px;left:' + b[2] +
  'px;top:' + b[3] + 'px;opacity:' + (b[4] ?? 1) + '"></span>').join('');

export const boton = (texto, act, { valor, clase = 'white', icono, ancho = true } = {}) =>
  '<button class="pill h52 ' + clase + ' tap" data-act="' + act + '"' +
  (valor !== undefined && valor !== null ? ' data-v="' + esc(valor) + '"' : '') +
  ' style="justify-content:center;' + (ancho ? 'width:100%' : '') + '">' +
  (icono ? ic(icono, 18) : '') + esc(texto) + '</button>';

export const enlace = (texto, act, { rojo, valor } = {}) =>
  '<button class="tap bm" data-act="' + act + '"' + (valor !== undefined ? ' data-v="' + esc(valor) + '"' : '') +
  ' style="display:block;width:100%;text-align:center;padding:14px 0;' + (rojo ? 'color:var(--danger)' : '') + '">' +
  esc(texto) + '</button>';

/** Tarjeta de aviso (amarilla o roja) */
export const aviso = (tipo, icono, titulo, texto) =>
  '<div class="card ' + (tipo === 'danger' ? 'dangerc' : tipo === 'ok' ? 'okc' : 'warn') + '" style="gap:12px" role="alert">' +
  '<div class="row top"><span class="cb s40 fill" style="color:' +
  (tipo === 'danger' ? 'var(--danger)' : tipo === 'ok' ? 'var(--ok)' : 'var(--warn)') + '">' +
  (icono === '!' ? ic('alert', 18) : ic(icono, 18)) + '</span>' +
  '<div class="grow stack" style="gap:4px"><span class="ct"' +
  (tipo === 'danger' ? ' style="color:var(--danger)"' : '') + '>' + titulo + '</span>' +
  '<span class="cap mute">' + texto + '</span></div></div></div>';

/** Etiqueta "simulado": se usa donde el prototipo finge algo */
export const simulado = (texto) =>
  '<span class="sim" title="Parte simulada del prototipo">' + esc(texto || 'Simulado') + '</span>';

/* ------------------------------------------------------------
   Estados: cargando, vacio y error
   ------------------------------------------------------------ */
export const cargandoTarjetas = (cuantas = 2) =>
  Array.from({ length: cuantas }, () =>
    '<div class="card p16" style="gap:10px" aria-hidden="true">' +
    '<div class="row"><span class="skel circ" style="width:44px;height:44px"></span>' +
    '<span class="grow stack" style="gap:8px"><span class="skel l1"></span><span class="skel l3"></span></span></div>' +
    '<span class="skel l2"></span></div>').join('');

export const vacio = (titulo, texto, botonTexto, botonAct) =>
  '<div class="card empty"><span class="cb s52 field">' + ic('search', 22) + '</span>' +
  '<span class="ct">' + esc(titulo) + '</span>' +
  '<span class="body mute">' + esc(texto) + '</span>' +
  (botonTexto ? '<div style="width:100%;padding-top:4px">' + boton(botonTexto, botonAct, { clase:'fieldbg' }) + '</div>' : '') +
  '</div>';

export const errorCaja = (titulo, texto, botonTexto, botonAct) =>
  '<div class="card dangerc" style="gap:12px" role="alert">' +
  '<div class="row top"><span class="cb s40 fill" style="color:var(--danger)">' + ic('alert', 18) + '</span>' +
  '<div class="grow stack" style="gap:4px"><span class="ct" style="color:var(--danger)">' + esc(titulo) + '</span>' +
  '<span class="cap mute">' + esc(texto) + '</span></div></div>' +
  (botonTexto ? boton(botonTexto, botonAct, { clase:'white', icono:'refresh' }) : '') + '</div>';

/* ------------------------------------------------------------
   Campos de formulario con etiqueta, ayuda y error
   ------------------------------------------------------------ */
export function campo(id, etiqueta, valor, o = {}){
  const hayError = !!o.error;
  const idAyuda = 'ayuda-' + id;
  return '<div class="campo">' +
    '<label class="label" for="' + id + '">' + esc(etiqueta) + (o.requerido ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
    '<div class="field' + (hayError ? ' err' : '') + '">' +
    (o.icono ? '<span class="mute">' + ic(o.icono, 18) + '</span>' : '') +
    '<input id="' + id + '" value="' + esc(valor ?? '') + '"' +
      ' type="' + (o.tipo || 'text') + '"' +
      ' placeholder="' + esc(o.ph || '') + '"' +
      (o.modo ? ' inputmode="' + o.modo + '"' : '') +
      (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : ' autocomplete="off"') +
      (o.requerido ? ' required' : '') +
      (hayError ? ' aria-invalid="true"' : '') +
      ' aria-describedby="' + idAyuda + '">' +
    (o.unidad ? '<span class="label mute">' + esc(o.unidad) + '</span>' : '') +
    (o.accionDerecha || '') +
    '</div>' +
    '<span class="ayuda' + (hayError ? ' err' : '') + '" id="' + idAyuda + '"' + (hayError ? ' role="alert"' : '') + '>' +
    (hayError ? ic('alert', 14) + '<span>' + esc(o.error) + '</span>' : esc(o.ayuda || '')) + '</span>' +
    '</div>';
}
