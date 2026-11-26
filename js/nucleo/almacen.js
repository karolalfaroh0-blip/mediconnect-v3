/* ============================================================
   MediConnect · almacen.js
   La "base de datos" de la demo: el almacenamiento del navegador.

   ALCANCE REAL (importante y honesto):
   - Lo que se guarda aqui vive SOLO en este telefono o navegador.
     Sobrevive a recargar la pagina y a cerrar el navegador.
   - Dos personas en dos telefonos NO comparten agenda.
     Para eso haria falta un servidor; esta decidido como paso futuro.
   - Dentro de un mismo navegador si hay control real: dos pestanas
     comparten el mismo almacenamiento, y cada escritura vuelve a leer
     antes de guardar, asi que un horario no se puede reservar dos veces.
   ============================================================ */

import { CLAVES } from './config.js';

const VERSION = 3;

/* Estructura vacia */
function vacio(){
  return {
    version: VERSION,
    usuarios: [],
    citas: [],
    ocupados: [],       // horarios tomados "por otros pacientes" (semilla de la demo)
    eventos: [],        // bitacora corta, util para el panel del presentador
    semilla: null       // fecha para la que se genero la agenda de ejemplo
  };
}

/* ------------------------------------------------------------
   Lectura y escritura basicas
   ------------------------------------------------------------ */
export function leer(){
  try{
    const crudo = localStorage.getItem(CLAVES.datos);
    if (!crudo) return vacio();
    const d = JSON.parse(crudo);
    if (!d || d.version !== VERSION) return vacio();   // version vieja: se empieza limpio
    // Defensa minima: si falta una lista, se repone
    for (const k of ['usuarios','citas','ocupados','eventos']) if (!Array.isArray(d[k])) d[k] = [];
    return d;
  }catch(e){
    console.warn('No se pudo leer el almacenamiento:', e);
    return vacio();
  }
}

export function escribir(datos){
  try{
    localStorage.setItem(CLAVES.datos, JSON.stringify(datos));
    return { ok:true };
  }catch(e){
    // Pasa en navegacion privada o si el almacenamiento esta lleno
    console.warn('No se pudo guardar:', e);
    return { ok:false, error:'sin-almacenamiento' };
  }
}

/**
 * Transaccion: lee lo ultimo que hay guardado, deja que la funcion
 * lo modifique y guarda. Como vuelve a leer justo antes de escribir,
 * dos pestanas del mismo navegador no se pisan.
 *
 * La funcion recibe los datos y puede devolver un resultado.
 * Si devuelve { abortar:true, ... } no se guarda nada.
 */
export function transaccion(fn){
  const datos = leer();
  const resultado = fn(datos);
  if (resultado && resultado.abortar) return resultado;
  const guardado = escribir(datos);
  if (!guardado.ok) return { ok:false, error:guardado.error };
  return resultado === undefined ? { ok:true } : resultado;
}

/* ------------------------------------------------------------
   Ajustes de la demo (separados de los datos)
   ------------------------------------------------------------ */
const AJUSTES_POR_DEFECTO = {
  n8nBase: '',
  recordatorioMinutos: 3,       // para poder probarlo en vivo durante la exposicion
  notificarPorCorreo: true,
  mostrarPanel: null            // null = automatico
};

export function leerAjustes(){
  try{
    const crudo = localStorage.getItem(CLAVES.ajustes);
    return Object.assign({}, AJUSTES_POR_DEFECTO, crudo ? JSON.parse(crudo) : {});
  }catch(e){
    return Object.assign({}, AJUSTES_POR_DEFECTO);
  }
}

export function guardarAjustes(parcial){
  const nuevos = Object.assign(leerAjustes(), parcial);
  try{ localStorage.setItem(CLAVES.ajustes, JSON.stringify(nuevos)); }catch(e){}
  return nuevos;
}

/* ------------------------------------------------------------
   Sesion abierta (se guarda aparte para poder cerrarla sola)
   ------------------------------------------------------------ */
export function leerSesion(){
  try{ return JSON.parse(localStorage.getItem(CLAVES.sesion) || 'null'); }
  catch(e){ return null; }
}
export function guardarSesion(s){
  try{
    if (s) localStorage.setItem(CLAVES.sesion, JSON.stringify(s));
    else localStorage.removeItem(CLAVES.sesion);
  }catch(e){}
}

/* ------------------------------------------------------------
   Bitacora: se queda con los ultimos 60 eventos
   ------------------------------------------------------------ */
export function anotar(datos, tipo, detalle){
  datos.eventos.push({ ts: Date.now(), tipo, detalle });
  if (datos.eventos.length > 60) datos.eventos.splice(0, datos.eventos.length - 60);
}

/* ------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------ */

/** Identificador unico corto, sin librerias */
export function nuevoId(prefijo){
  const al = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(36)).join('')
    : Math.random().toString(36).slice(2);
  return (prefijo ? prefijo + '_' : '') + Date.now().toString(36) + al.slice(0, 6);
}

/** Codigo legible para el paciente y el QR: MC-7K3QB2 */
export function nuevoCodigo(){
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin letras que se confunden
  let s = '';
  const bytes = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto.getRandomValues(new Uint8Array(6))
    : Array.from({length:6}, () => Math.floor(Math.random() * 256));
  for (const b of bytes) s += abc[b % abc.length];
  return 'MC-' + s;
}

/** Borra todo lo de MediConnect (el panel lo usa para reiniciar la demo) */
export function borrarTodo(){
  try{
    localStorage.removeItem(CLAVES.datos);
    localStorage.removeItem(CLAVES.sesion);
    localStorage.removeItem(CLAVES.ajustes);
  }catch(e){}
}

/** ¿Se puede guardar algo en este navegador? (navegacion privada, permisos) */
export function almacenamientoDisponible(){
  try{
    const k = '__mc_prueba__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  }catch(e){ return false; }
}
