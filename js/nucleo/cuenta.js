/* ============================================================
   MediConnect · cuenta.js
   Registro, inicio de sesion y perfil.

   HASTA DONDE LLEGA (hay que decirlo claro en la exposicion):
   la contrasena NO se guarda. Se guarda el resultado de pasarla
   por PBKDF2-SHA256 con 120.000 vueltas y una sal distinta para
   cada persona, que es la misma tecnica que usan los sitios reales.
   Pero como todo vive en este navegador, cualquiera con acceso al
   telefono podria borrarlo o modificarlo. Es una cuenta de demo:
   sirve para personalizar la experiencia y guardar citas, no para
   proteger informacion medica real. Por eso la app no pide datos
   medicos sensibles.
   ============================================================ */

import { transaccion, leer, leerSesion, guardarSesion, nuevoId, anotar } from './almacen.js';

/* ------------------------------------------------------------
   Validaciones (reutilizadas por los formularios)
   ------------------------------------------------------------ */
export const reglas = {
  nombre: (v) => {
    const s = (v || '').trim();
    if (!s) return 'Escribí tu nombre';
    if (s.length < 3) return 'El nombre es muy corto';
    if (!/^[\p{L}\s'.-]+$/u.test(s)) return 'Usá solo letras';
    return null;
  },
  correo: (v) => {
    const s = (v || '').trim();
    if (!s) return 'Escribí tu correo';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(s)) return 'Revisá tu correo: le falta algo';
    return null;
  },
  telefono: (v) => {
    const s = (v || '').trim();
    if (!s) return null;                              // es opcional
    if (!/^\d{4}-?\d{4}$/.test(s)) return 'El teléfono lleva 8 dígitos';
    return null;
  },
  clave: (v) => {
    const s = v || '';
    if (s.length < 8) return 'Mínimo 8 caracteres';
    if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Combiná letras y números';
    return null;
  },
  fechaNac: (v) => {
    const s = (v || '').trim();
    if (!s) return null;
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return 'Usá el formato dd/mm/aaaa';
    const [d, m, a] = s.split('/').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return 'Esa fecha no existe';
    const anioActual = new Date().getFullYear();
    if (a < 1900 || a > anioActual) return 'Revisá el año';
    return null;
  }
};

export const normalizarCorreo = (c) => (c || '').trim().toLowerCase();

/* ------------------------------------------------------------
   Hash de la contrasena
   ------------------------------------------------------------ */
const hayCripto = () => typeof crypto !== 'undefined' && crypto.subtle && crypto.getRandomValues;

const aHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

export function nuevaSal(){
  if (hayCripto()) return aHex(crypto.getRandomValues(new Uint8Array(16)));
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function derivarClave(clave, sal){
  if (!hayCripto()){
    // Respaldo muy simple para contextos sin cripto (abrir el archivo con doble clic).
    // No es seguro; la app lo advierte en pantalla.
    let h = 0;
    const txt = sal + '|' + clave;
    for (let i = 0; i < txt.length; i++){ h = (h * 31 + txt.charCodeAt(i)) | 0; }
    return 'inseguro:' + (h >>> 0).toString(16);
  }
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt: enc.encode(sal), iterations: 120000, hash:'SHA-256' },
    material, 256
  );
  return 'pbkdf2:' + aHex(bits);
}

/** ¿Estamos en un contexto donde el hash es de verdad? */
export const criptoFuerte = () => hayCripto();

/* ------------------------------------------------------------
   Perfil por defecto de una cuenta nueva
   ------------------------------------------------------------ */
function perfilNuevo(nombre, correo, telefono){
  return {
    nombre: nombre.trim(),
    correo: normalizarCorreo(correo),
    telefono: (telefono || '').trim(),
    nacimiento: '',
    direccion: '',
    sangre: '',
    estatura: '',
    peso: '',
    alergias: '',
    condiciones: '',
    emNombre: '',
    emParentesco: '',
    emTelefono: '',
    foto: '',                  // sin foto: se muestran las iniciales
    recordatorios: { citas: true, medicinas: true, resultados: true },
    privacidad: { compartirExpediente: true }
  };
}

/* Seguros de ejemplo que se le dan a toda cuenta nueva, para que
   los casos C3 y C4 se puedan demostrar sin escribir nada. */
function segurosDeEjemplo(){
  return [
    { id:'sisa',   plan:'Colectivo', poliza:'ASG-20481',  principal:true,  vigente:true },
    { id:'mapfre', plan:'Familiar',  poliza:'12-345678',  principal:false, vigente:false }
  ];
}

/* ------------------------------------------------------------
   Registro
   ------------------------------------------------------------ */
export async function registrar({ nombre, correo, telefono, clave }){
  const err = reglas.nombre(nombre) || reglas.correo(correo) || reglas.telefono(telefono) || reglas.clave(clave);
  if (err) return { ok:false, error: err };

  const correoN = normalizarCorreo(correo);
  if (leer().usuarios.some(u => u.correo === correoN)){
    return { ok:false, error:'Ya hay una cuenta con ese correo. Probá iniciar sesión.' };
  }

  const sal = nuevaSal();
  const hash = await derivarClave(clave, sal);

  const resultado = transaccion((datos) => {
    // Se vuelve a comprobar aqui dentro, por si otra pestana lo creo mientras tanto
    if (datos.usuarios.some(u => u.correo === correoN)){
      return { abortar:true, ok:false, error:'Ya hay una cuenta con ese correo.' };
    }
    const usuario = {
      id: nuevoId('usr'),
      correo: correoN,
      sal, hash,
      creado: Date.now(),
      perfil: perfilNuevo(nombre, correo, telefono),
      seguros: segurosDeEjemplo()
    };
    datos.usuarios.push(usuario);
    anotar(datos, 'cuenta.registrar', correoN);
    return { ok:true, usuario };
  });

  if (resultado.ok) abrirSesion(resultado.usuario.id);
  return resultado;
}

/* ------------------------------------------------------------
   Inicio de sesion
   ------------------------------------------------------------ */
export async function iniciarSesion({ correo, clave }){
  const correoN = normalizarCorreo(correo);
  const usuario = leer().usuarios.find(u => u.correo === correoN);

  // Mismo mensaje exista o no la cuenta: no se le dice a nadie qué correos están registrados
  const generico = 'Correo o contraseña incorrectos';
  if (!usuario) return { ok:false, error: generico };

  const hash = await derivarClave(clave, usuario.sal);
  if (hash !== usuario.hash) return { ok:false, error: generico };

  abrirSesion(usuario.id);
  return { ok:true, usuario };
}

/* ------------------------------------------------------------
   Sesion
   ------------------------------------------------------------ */
export function abrirSesion(usuarioId){
  guardarSesion({ usuarioId, desde: Date.now() });
}

export function cerrarSesion(){
  guardarSesion(null);
}

/** Devuelve el usuario con la sesion abierta, o null si se explora como invitado */
export function usuarioActual(){
  const s = leerSesion();
  if (!s) return null;
  const u = leer().usuarios.find(x => x.id === s.usuarioId);
  if (!u){ guardarSesion(null); return null; }
  return u;
}

export const haySesion = () => !!usuarioActual();

/* ------------------------------------------------------------
   Perfil
   ------------------------------------------------------------ */
export function guardarPerfil(parcial){
  const s = leerSesion();
  if (!s) return { ok:false, error:'No hay una sesión abierta' };

  return transaccion((datos) => {
    const u = datos.usuarios.find(x => x.id === s.usuarioId);
    if (!u) return { abortar:true, ok:false, error:'No encontramos tu cuenta' };
    u.perfil = Object.assign({}, u.perfil, parcial);
    anotar(datos, 'perfil.guardar', Object.keys(parcial).join(','));
    return { ok:true, perfil: u.perfil };
  });
}

export function guardarSeguros(seguros){
  const s = leerSesion();
  if (!s) return { ok:false, error:'No hay una sesión abierta' };
  return transaccion((datos) => {
    const u = datos.usuarios.find(x => x.id === s.usuarioId);
    if (!u) return { abortar:true, ok:false, error:'No encontramos tu cuenta' };
    u.seguros = seguros;
    return { ok:true, seguros };
  });
}

/** Edad a partir de 'dd/mm/aaaa' */
export function edad(nacimiento, hoyFecha){
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((nacimiento || '').trim());
  if (!m) return null;
  const [, d, mes, a] = m.map(Number);
  const [ha, hm, hd] = (hoyFecha || '').split('-').map(Number);
  if (!ha) return null;
  let años = ha - a;
  if (hm < mes || (hm === mes && hd < d)) años--;
  return años >= 0 && años < 130 ? años : null;
}

export const iniciales = (n) =>
  (n || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

export const primerNombre = (n) => (n || '').trim().split(/\s+/)[0] || '';
