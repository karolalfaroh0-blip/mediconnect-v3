/* ============================================================
   MediConnect · estado.js
   El estado de la aplicacion y las funciones para moverse por ella.

   Un solo objeto `S` guarda "en que esta la app ahora mismo".
   Cuando algo cambia se llama a repintar() y la pantalla se vuelve
   a dibujar a partir de ese estado. Es el mismo patron del
   prototipo original, ordenado y documentado.
   ============================================================ */

import { hoy } from './fechas.js';
import { usuarioActual } from './cuenta.js';

export const S = {
  /* --- navegacion --- */
  pantalla: 'bienvenida',
  historial: [],
  atras: false,
  hoja: null,
  hojaDatos: null,

  /* --- avisos flotantes --- */
  aviso: null,
  avisoTipo: '',
  avisoDesde: 0,

  /* --- busqueda de medicos --- */
  q: '',
  chip: 'Todos',
  soloCubiertos: false,
  especialidadQ: '',
  cargandoLista: false,

  /* --- reserva en curso --- */
  medicoId: 'her',
  fecha: null,
  hora: null,
  esControl: false,
  claveIdem: null,
  reservando: false,
  ultimoError: null,

  /* --- reprogramacion --- */
  nuevaFecha: null,
  nuevaHora: null,

  /* --- calendario del control --- */
  mesCalendario: null,

  /* --- sintomas --- */
  sintomas: new Set(),
  desde: '2–3 días',
  sintomaQ: '',
  verMasSintomas: false,

  /* --- seguro y pago (simulados) --- */
  seguroElegido: 'sisa',
  metodoPago: 0,
  pagado: false,

  /* --- cuenta --- */
  auth: { modo: 'registro', nombre: '', correo: '', clave: '', verClave: false, errores: {}, enviando: false, error: null, destino: null },

  /* --- cita que se esta viendo --- */
  citaId: null,
  citaCodigo: null,

  /* --- visita (sala, consulta, laboratorio) --- */
  turno: 2,
  etapaConsulta: 'live',
  pasoLab: 1,
  hizoLab: false,
  visitaTerminada: false,
  calificacion: 0,
  seguimiento: 'pendiente',
  avisarTurno: true,

  /* --- expediente --- */
  pestanaExpediente: 'Resultados',
  examenId: null,
  enviarA: null,
  notaEnvio: '',
  enviados: {},
  medicinas: [true, true],
  pregunta: -1,

  /* --- perfil --- */
  borrador: null,
  erroresPerfil: {},
  enfoquePerfil: null,
  agregarSeguro: { q: '', id: null, poliza: '', plan: 'Familiar', principal: false },

  /* --- ajustes de la demo --- */
  ajustesBorrador: null,
  probandoConexion: false,
  resultadoConexion: null,

  /* --- panel del presentador --- */
  demo: { lab: true, pago: 'ok', seguro: 'vigente', sinCupos: true },
  casos: new Set(),
  bitacora: [],

  /* --- fecha de referencia --- */
  hoy: hoy()
};

/* ------------------------------------------------------------
   El render lo define app.js y se registra aqui, para que
   cualquier pantalla pueda pedir un repintado sin importar app.js
   (y evitar importaciones circulares).
   ------------------------------------------------------------ */
let _render = () => {};
export function registrarRender(fn){ _render = fn; }

let _temporizadores = [];
export function limpiarTemporizadores(){
  _temporizadores.forEach(clearTimeout);
  _temporizadores = [];
}
export function programar(fn, ms){
  const t = setTimeout(() => {
    _temporizadores = _temporizadores.filter(x => x !== t);
    fn();
  }, ms);
  _temporizadores.push(t);
  return t;
}
export const hayTemporizadores = () => _temporizadores.length > 0;

/* ------------------------------------------------------------
   Navegacion
   ------------------------------------------------------------ */
export function ir(pantalla, { reemplazar = false } = {}){
  limpiarTemporizadores();
  if (!reemplazar) S.historial.push(S.pantalla);
  S.pantalla = pantalla;
  S.atras = false;
  S.hoja = null;
  _render(true);
}

export function volver(){
  limpiarTemporizadores();
  S.pantalla = S.historial.pop() || 'inicio';
  S.atras = true;
  S.hoja = null;
  _render(true);
}

export function tabear(pantalla){
  limpiarTemporizadores();
  S.historial = [];
  S.pantalla = pantalla;
  S.atras = false;
  S.hoja = null;
  _render(true);
}

export function repintar(){ _render(false); }

/* ------------------------------------------------------------
   Hojas (modales que suben desde abajo)
   ------------------------------------------------------------ */
export function abrirHoja(nombre, datos){
  S.hoja = nombre;
  S.hojaDatos = datos || null;
  _render(false);
}
export function cerrarHoja(){
  S.hoja = null;
  S.hojaDatos = null;
  _render(false);
}

/* ------------------------------------------------------------
   Avisos flotantes. `tipo` puede ser '', 'ok' o 'err'.
   ------------------------------------------------------------ */
let relojAviso = null;
export function avisar(texto, tipo = ''){
  S.aviso = texto;
  S.avisoTipo = tipo;
  S.avisoDesde = Date.now();
  const region = document.getElementById('anuncio');
  if (region) region.textContent = texto;
  clearTimeout(relojAviso);
  const mio = texto;
  relojAviso = setTimeout(() => {
    if (S.aviso === mio){ S.aviso = null; _render(false); }
  }, 3200);
  _render(false);
}

/* ------------------------------------------------------------
   Bitacora del panel del presentador.
   Muestra la logica por dentro: condiciones, estados, decisiones.
   ------------------------------------------------------------ */
export function log(texto, tipo){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  S.bitacora.push({ hora: hh + ':' + mm + ':' + ss, texto, tipo: tipo || '' });
  if (S.bitacora.length > 40) S.bitacora.shift();
}

export function marcarCaso(id){
  if (!S.casos.has(id)){
    S.casos.add(id);
    log('caso ' + id + ' demostrado', 'ok');
  }
}

/* ------------------------------------------------------------
   Atajos
   ------------------------------------------------------------ */
export const usuario = () => usuarioActual();
export const usuarioId = () => usuarioActual()?.id || null;
export const perfil = () => usuarioActual()?.perfil || null;
export const seguros = () => usuarioActual()?.seguros || [];
