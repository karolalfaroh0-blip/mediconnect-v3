/* ============================================================
   MediConnect · automatizacion.js
   El puente entre la app y n8n.

   Regla de oro: la automatizacion NUNCA decide si la cita existe.
   Primero se guarda la cita; despues se avisa. Si el correo falla,
   la cita sigue ahi y la pantalla dice exactamente que paso.

   Tampoco sustituye el control de acceso: n8n solo recibe un aviso
   ya validado por la app, con los datos minimos para el correo.
   ============================================================ */

import { APP, N8N, ZONA, PARAMS, urlApp } from './config.js';
import { leerAjustes, guardarAjustes, nuevoId } from './almacen.js';
import { medico } from './datos.js';
import { aInstante, fechaLarga, hora12, selloIcs } from './fechas.js';
import { ics, urlGoogle } from './calendario.js';
import { marcarNotificacion } from './agenda.js';

/* ------------------------------------------------------------
   Direccion del webhook
   ------------------------------------------------------------ */
export function baseN8n(){
  const porUrl = PARAMS.get('n8n');
  if (porUrl) return limpiarBase(porUrl);
  const guardada = leerAjustes().n8nBase;
  if (guardada) return limpiarBase(guardada);
  return N8N.base ? limpiarBase(N8N.base) : '';
}

export function guardarBaseN8n(valor){
  const limpia = valor ? limpiarBase(valor) : '';
  guardarAjustes({ n8nBase: limpia });
  return limpia;
}

function limpiarBase(v){
  return String(v).trim().replace(/\s+/g, '').replace(/\/+$/, '');
}

export const configurado = () => !!baseN8n();

/** Comprueba que la direccion escrita tenga forma de URL https */
export function validarBase(valor){
  const v = limpiarBase(valor || '');
  if (!v) return null;                        // vacio = automatizaciones apagadas, es valido
  if (!/^https?:\/\//i.test(v)) return 'La dirección tiene que empezar con https://';
  try{ new URL(v); }catch(e){ return 'Esa dirección no es válida'; }
  if (/^http:\/\//i.test(v) && !/localhost|127\.0\.0\.1/.test(v))
    return 'Usá https:// (los teléfonos bloquean http)';
  return null;
}

/* ------------------------------------------------------------
   Envio con tiempo limite y un reintento
   ------------------------------------------------------------ */
async function postear(ruta, cuerpo, { tiempoLimiteMs = N8N.tiempoLimiteMs } = {}){
  const base = baseN8n();
  if (!base) return { ok:false, estado:'apagado', detalle:'Automatizaciones sin configurar' };

  const url = base + ruta;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempoLimiteMs);

  try{
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
      mode: 'cors',
      cache: 'no-store'
    });
    clearTimeout(reloj);

    let datos = null;
    try{ datos = await r.json(); }catch(e){ /* n8n puede responder vacio */ }

    if (!r.ok){
      return { ok:false, estado:'fallo', detalle:'El servidor respondió ' + r.status, http:r.status, datos };
    }
    return { ok:true, estado:'enviado', datos };
  }catch(e){
    clearTimeout(reloj);
    const esTiempo = e.name === 'AbortError';
    return {
      ok:false,
      estado:'fallo',
      detalle: esTiempo ? 'La automatización no respondió a tiempo'
                        : 'No se pudo conectar con la automatización',
      causa: esTiempo ? 'tiempo' : 'red'
    };
  }
}

/** Envia y, si falla por red, reintenta una vez */
async function enviar(ruta, cuerpo){
  let r = await postear(ruta, cuerpo);
  if (!r.ok && r.estado === 'fallo' && N8N.reintentos > 0){
    await new Promise(res => setTimeout(res, 900));
    const r2 = await postear(ruta, cuerpo);
    if (r2.ok) return Object.assign(r2, { reintentado:true });
    return Object.assign(r2, { reintentado:true });
  }
  return r;
}

/* ------------------------------------------------------------
   Armado del mensaje
   ------------------------------------------------------------ */
export function urlComprobante(cita){
  return urlApp() + 'comprobante.html?cita=' + encodeURIComponent(cita.codigo);
}

function sobreCita(cita){
  const doc = medico(cita.medicoId);
  const inicio = aInstante(cita.fecha, cita.hora);
  const fin = new Date(inicio.getTime() + (cita.duracionMin || 30) * 60000);
  const comprobante = urlComprobante(cita);

  return {
    codigo: cita.codigo,
    estado: cita.estado,
    esControl: !!cita.control,
    fecha: cita.fecha,
    hora: cita.hora,
    fechaTexto: fechaLarga(cita.fecha),
    horaTexto: hora12(cita.hora),
    inicioUtc: inicio.toISOString(),
    finUtc: fin.toISOString(),
    selloInicio: selloIcs(inicio),
    duracionMin: cita.duracionMin || 30,
    medico: { id: doc.id, nombre: doc.n, especialidad: doc.sp, consultorio: doc.room },
    lugar: { clinica: APP.clinica.nombre, direccion: APP.clinica.direccion, mapa: APP.clinica.mapa, telefono: APP.clinica.telefono },
    enlaces: {
      comprobante,
      calendarioGoogle: urlGoogle(cita, { urlComprobante: comprobante })
    }
  };
}

function sobrePaciente(perfil){
  // Solo lo necesario para el correo. Nada medico.
  return {
    nombre: perfil?.nombre || 'Paciente',
    correo: perfil?.correo || null
  };
}

function sobre(evento, extra){
  return Object.assign({
    evento,
    idEvento: nuevoId('ev'),          // clave de idempotencia: n8n descarta repetidos
    enviadoEn: new Date().toISOString(),
    zona: { id: ZONA.id, desfase: ZONA.desfaseIso },
    app: { nombre: APP.nombre, version: APP.version, url: urlApp() }
  }, extra);
}

/* ------------------------------------------------------------
   Eventos
   ------------------------------------------------------------ */

/** Bienvenida al crear la cuenta */
export async function avisarRegistro(perfil){
  if (!configurado()) return { ok:false, estado:'apagado' };
  return enviar(N8N.rutas.registro, sobre('registro', {
    paciente: sobrePaciente(perfil)
  }));
}

/**
 * Confirmacion de la cita. Manda tambien el archivo .ics completo
 * para que n8n lo adjunte al correo.
 */
export async function avisarReserva(cita, perfil){
  if (!configurado()){
    marcarNotificacion(cita.id, { estado:'apagado', error:null });
    return { ok:false, estado:'apagado' };
  }
  marcarNotificacion(cita.id, { estado:'enviando' });

  const comprobante = urlComprobante(cita);
  const r = await enviar(N8N.rutas.reserva, sobre('reserva', {
    paciente: sobrePaciente(perfil),
    cita: sobreCita(cita),
    ics: ics(cita, { urlComprobante: comprobante }),
    icsNombre: 'mediconnect-' + cita.codigo.toLowerCase() + '.ics'
  }));

  marcarNotificacion(cita.id, {
    estado: r.ok ? 'enviado' : (r.estado === 'apagado' ? 'apagado' : 'fallo'),
    error: r.ok ? null : (r.detalle || 'No se pudo enviar'),
    intentos: (r.reintentado ? 2 : 1)
  });

  // Si el correo salió bien, se deja programado el recordatorio en n8n.
  if (r.ok) programarRecordatorioAutomatico(cita, perfil);
  return r;
}

/**
 * Deja el recordatorio listo en n8n.
 * Por defecto una hora antes de la cita; si falta menos, se descarta.
 */
export function programarRecordatorioAutomatico(cita, perfil){
  const faltanMin = Math.round((aInstante(cita.fecha, cita.hora).getTime() - Date.now()) / 60000);
  const enMinutos = faltanMin - 60;
  if (enMinutos < 1) return Promise.resolve({ ok: false, estado: 'muy-pronto' });
  return pedirRecordatorio(cita, perfil, enMinutos);
}

/** Aviso de cambio de fecha u hora */
export async function avisarCambio(cita, perfil, antes){
  if (!configurado()){
    marcarNotificacion(cita.id, { estado:'apagado' });
    return { ok:false, estado:'apagado' };
  }
  marcarNotificacion(cita.id, { estado:'enviando' });

  const comprobante = urlComprobante(cita);
  const r = await enviar(N8N.rutas.cambio, sobre('cambio', {
    paciente: sobrePaciente(perfil),
    cita: sobreCita(cita),
    anterior: antes ? { fecha: antes.fecha, hora: antes.hora, fechaTexto: fechaLarga(antes.fecha), horaTexto: hora12(antes.hora) } : null,
    ics: ics(cita, { urlComprobante: comprobante }),
    icsNombre: 'mediconnect-' + cita.codigo.toLowerCase() + '.ics'
  }));

  marcarNotificacion(cita.id, {
    estado: r.ok ? 'enviado' : 'fallo',
    error: r.ok ? null : (r.detalle || 'No se pudo enviar')
  });

  // El recordatorio se vuelve a programar con la hora nueva
  if (r.ok) programarRecordatorioAutomatico(cita, perfil);
  return r;
}

/** Aviso de cancelacion */
export async function avisarCancelacion(cita, perfil){
  if (!configurado()){
    marcarNotificacion(cita.id, { estado:'apagado' });
    return { ok:false, estado:'apagado' };
  }
  marcarNotificacion(cita.id, { estado:'enviando' });

  const r = await enviar(N8N.rutas.cancelacion, sobre('cancelacion', {
    paciente: sobrePaciente(perfil),
    cita: sobreCita(cita),
    razon: cita.razonCancelacion || null
  }));

  marcarNotificacion(cita.id, {
    estado: r.ok ? 'enviado' : 'fallo',
    error: r.ok ? null : (r.detalle || 'No se pudo enviar')
  });

  // La cita cancelada no debe recordarse: se le avisa a n8n que lo descarte
  if (r.ok) cancelarRecordatorio(cita);
  return r;
}

/**
 * Pide a n8n que programe el recordatorio dentro de `minutos`.
 * Pocos minutos permiten mostrarlo en vivo durante la exposicion.
 */
export async function pedirRecordatorio(cita, perfil, minutos){
  if (!configurado()) return { ok:false, estado:'apagado' };
  return enviar(N8N.rutas.recordatorio, sobre('recordatorio', {
    accion: 'programar',
    paciente: sobrePaciente(perfil),
    cita: sobreCita(cita),
    enMinutos: minutos ?? leerAjustes().recordatorioMinutos
  }));
}

/** Le dice a n8n que borre el recordatorio pendiente de una cita */
export async function cancelarRecordatorio(cita){
  if (!configurado()) return { ok:false, estado:'apagado' };
  return enviar(N8N.rutas.recordatorio, sobre('recordatorio', {
    accion: 'cancelar',
    cita: { codigo: cita.codigo, estado: cita.estado }
  }));
}

/* ------------------------------------------------------------
   Prueba de conexion (pantalla de ajustes)
   ------------------------------------------------------------ */
export async function probarConexion(){
  const base = baseN8n();
  if (!base) return { ok:false, estado:'apagado', detalle:'Todavía no hay dirección configurada' };
  const r = await postear(N8N.rutas.registro, sobre('prueba', {
    paciente: { nombre:'Prueba de conexión', correo:null },
    prueba: true
  }), { tiempoLimiteMs: 8000 });
  return r;
}

/* ------------------------------------------------------------
   Texto para la interfaz: que decirle a la persona
   ------------------------------------------------------------ */
export function textoEnvio(notificacion){
  const e = notificacion?.estado || 'pendiente';
  if (e === 'enviado')  return { clase:'enviado',  texto:'Confirmación enviada a tu correo' };
  if (e === 'enviando') return { clase:'enviando', texto:'Enviando la confirmación…' };
  if (e === 'fallo')    return { clase:'fallo',    texto:'No se pudo enviar el correo' };
  if (e === 'apagado')  return { clase:'apagado',  texto:'Correo no configurado en esta demo' };
  return { clase:'pendiente', texto:'Correo pendiente de enviar' };
}
