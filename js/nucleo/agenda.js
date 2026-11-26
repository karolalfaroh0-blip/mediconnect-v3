/* ============================================================
   MediConnect · agenda.js
   El corazon logico del proyecto: disponibilidad y reservas.

   Aqui viven las reglas que un sistema de turnos tiene que cumplir:
     · solo se ofrece lo que esta libre;
     · un horario no se puede reservar dos veces;
     · un doble clic no crea dos citas;
     · nadie ve ni toca las citas de otra cuenta;
     · cancelar libera el horario y reprogramar lo mueve.
   ============================================================ */

import { REGLAS } from './config.js';
import { HORARIOS, medico } from './datos.js';
import { leer, transaccion, nuevoId, nuevoCodigo, anotar } from './almacen.js';
import {
  hoy, sumarDias, diasHabiles, esFinDeSemana, esPasado,
  horasFaltantes, aInstante, diferenciaDias
} from './fechas.js';

/* ------------------------------------------------------------
   Estados por los que pasa una cita
   ------------------------------------------------------------ */
export const ESTADOS = {
  AGENDADA:    'agendada',
  EN_SALA:     'en_sala',
  EN_CONSULTA: 'en_consulta',
  ATENDIDA:    'atendida',
  CANCELADA:   'cancelada'
};

export const ESTADO_ACTIVO = [ESTADOS.AGENDADA, ESTADOS.EN_SALA, ESTADOS.EN_CONSULTA];

/* ------------------------------------------------------------
   Bloqueo que controla el panel del presentador (caso C1).
   No es un dato guardado: es una simulacion que se enciende
   y se apaga durante la exposicion.
   ------------------------------------------------------------ */
export const simulacion = { diaSinCupos: true };

/* ------------------------------------------------------------
   Semilla: horarios que "ya tomaron otros pacientes".
   Es una funcion determinista (siempre da el mismo resultado para
   la misma combinacion), asi la agenda se ve viva pero no cambia
   de un render a otro ni al recargar.
   ------------------------------------------------------------ */
function revoltijo(texto){
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++){
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;        // 0..1
}

/** ¿Este hueco lo tiene tomado otro paciente? */
function tomadoPorOtro(medicoId, fecha, hora){
  return revoltijo(medicoId + '|' + fecha + '|' + hora) < 0.38;
}

/* ------------------------------------------------------------
   Lecturas
   ------------------------------------------------------------ */

/** Dias que ofrece el selector rapido: los proximos habiles desde hoy */
export function diasVisibles(desde){
  return diasHabiles(desde || hoy(), REGLAS.diasVisibles);
}

/** Todas las citas activas de un medico en un dia */
function citasDelDia(datos, medicoId, fecha){
  return datos.citas.filter(c =>
    c.medicoId === medicoId && c.fecha === fecha && ESTADO_ACTIVO.includes(c.estado));
}

/**
 * Estado de cada horario de un medico en un dia.
 * Devuelve: [{ hora, estado }] con estado en
 *   'libre' | 'ocupado' | 'mia' | 'pasado' | 'fuera'
 */
export function horariosDe(medicoId, fecha, usuarioId){
  const doc = medico(medicoId);
  if (!doc) return [];
  const datos = leer();
  const delDia = citasDelDia(datos, medicoId, fecha);
  const bloqueado = simulacion.diaSinCupos && fecha === diaBloqueado();

  return HORARIOS.map(hora => {
    if (!doc.agenda.includes(hora)) return { hora, estado:'fuera' };

    const mia = delDia.find(c => c.hora === hora && mismaCuenta(c, usuarioId));
    if (mia) return { hora, estado:'mia', citaId: mia.id };

    if (esPasado(fecha, hora)) return { hora, estado:'pasado' };
    if (horasFaltantes(fecha, hora) < REGLAS.anticipacionMinimaHoras) return { hora, estado:'pasado' };

    if (delDia.some(c => c.hora === hora)) return { hora, estado:'ocupado' };
    if (bloqueado) return { hora, estado:'ocupado' };
    if (tomadoPorOtro(medicoId, fecha, hora)) return { hora, estado:'ocupado' };

    return { hora, estado:'libre' };
  });
}

/** El dia que el panel del presentador deja sin cupos (el tercero visible) */
export function diaBloqueado(){
  const d = diasVisibles();
  return d[2] || null;
}

export const horariosLibres = (medicoId, fecha, usuarioId) =>
  horariosDe(medicoId, fecha, usuarioId).filter(h => h.estado === 'libre');

export const diaLleno = (medicoId, fecha, usuarioId) =>
  horariosLibres(medicoId, fecha, usuarioId).length === 0;

/** Primer dia con al menos un hueco, mirando hacia adelante */
export function proximoDiaLibre(medicoId, desdeFecha, usuarioId){
  let f = desdeFecha || hoy();
  for (let i = 0; i < 45; i++){
    if (!esFinDeSemana(f) && !diaLleno(medicoId, f, usuarioId)) return f;
    f = sumarDias(f, 1);
  }
  return null;
}

/** Texto 'Hoy, 2:00 p. m.' para la tarjeta del medico en el listado */
export function proximoHueco(medicoId, usuarioId){
  const f = proximoDiaLibre(medicoId, hoy(), usuarioId);
  if (!f) return null;
  const h = horariosLibres(medicoId, f, usuarioId)[0];
  return h ? { fecha: f, hora: h.hora } : null;
}

/* ------------------------------------------------------------
   Control de acceso: una cita es tuya si coincide la cuenta.
   Las citas de invitado solo se ven cuando NO hay sesion abierta.
   ------------------------------------------------------------ */
function mismaCuenta(cita, usuarioId){
  if (usuarioId) return cita.usuarioId === usuarioId;
  return cita.invitado === true && !cita.usuarioId;
}

/** Las citas de una cuenta, ordenadas por cuando empiezan */
export function citasDe(usuarioId, { incluirPasadas = true } = {}){
  const datos = leer();
  return datos.citas
    .filter(c => mismaCuenta(c, usuarioId))
    .filter(c => incluirPasadas || !esPasado(c.fecha, c.hora) || c.estado !== ESTADOS.AGENDADA)
    .sort((a, b) => aInstante(a.fecha, a.hora) - aInstante(b.fecha, b.hora));
}

/** La proxima cita activa (la que se muestra en Inicio) */
export function proximaCita(usuarioId){
  return citasDe(usuarioId)
    .filter(c => ESTADO_ACTIVO.includes(c.estado))
    .filter(c => !esPasado(c.fecha, c.hora) || c.estado !== ESTADOS.AGENDADA)[0] || null;
}

/** Busca por el codigo del QR. Solo devuelve lo que la cuenta puede ver. */
export function citaPorCodigo(codigo, usuarioId){
  const c = leer().citas.find(x => x.codigo === codigo);
  if (!c) return null;
  if (!mismaCuenta(c, usuarioId)) return { ajena:true };
  return c;
}

export const citaPorId = (id) => leer().citas.find(c => c.id === id) || null;

/* ------------------------------------------------------------
   RESERVAR
   Tres defensas, y las tres se pueden mostrar en clase:
     1. clave de idempotencia  -> el doble clic no duplica
     2. relectura y verificacion -> dos pestanas no chocan
     3. reglas de negocio      -> no en el pasado, no mas de N activas
   ------------------------------------------------------------ */
export function reservar({ medicoId, fecha, hora, usuarioId, motivo, pago, claveIdem, control = false }){
  const doc = medico(medicoId);
  if (!doc) return { ok:false, error:'No encontramos a ese médico', codigo:'medico-inexistente' };
  if (!doc.agenda.includes(hora)) return { ok:false, error:'Ese horario no lo atiende este médico', codigo:'fuera-de-agenda' };
  if (esFinDeSemana(fecha)) return { ok:false, error:'La clínica no atiende fines de semana', codigo:'fin-de-semana' };
  if (esPasado(fecha, hora)) return { ok:false, error:'Ese horario ya pasó', codigo:'en-el-pasado' };
  if (horasFaltantes(fecha, hora) < REGLAS.anticipacionMinimaHoras)
    return { ok:false, error:'Hay que reservar con al menos una hora de anticipación', codigo:'muy-pronto' };

  return transaccion((datos) => {
    // 1 · idempotencia: ¿ya procesamos este mismo intento?
    if (claveIdem){
      const ya = datos.citas.find(c => c.claveIdem === claveIdem);
      if (ya) return { abortar:true, ok:true, cita: ya, repetida:true };
    }

    // 2 · verificacion con lo ultimo guardado
    const ocupada = datos.citas.some(c =>
      c.medicoId === medicoId && c.fecha === fecha && c.hora === hora && ESTADO_ACTIVO.includes(c.estado));
    if (ocupada){
      return { abortar:true, ok:false, codigo:'horario-ocupado',
               error:'Alguien acaba de tomar ese horario. Elegí otro, por favor.' };
    }
    if (simulacion.diaSinCupos && fecha === diaBloqueado()){
      return { abortar:true, ok:false, codigo:'dia-sin-cupos', error:'Ese día ya no tiene cupos.' };
    }
    if (tomadoPorOtro(medicoId, fecha, hora)){
      return { abortar:true, ok:false, codigo:'horario-ocupado',
               error:'Ese horario ya está tomado. Elegí otro, por favor.' };
    }

    // 3 · limite de citas activas por paciente
    const activas = datos.citas.filter(c => mismaCuenta(c, usuarioId) && ESTADO_ACTIVO.includes(c.estado));
    if (activas.length >= REGLAS.maxCitasActivasPorPaciente){
      return { abortar:true, ok:false, codigo:'demasiadas',
               error:'Ya tenés ' + activas.length + ' citas activas. Cancelá una antes de agendar otra.' };
    }

    const cita = {
      id: nuevoId('cita'),
      codigo: nuevoCodigo(),
      usuarioId: usuarioId || null,
      invitado: !usuarioId,
      medicoId, fecha, hora,
      duracionMin: REGLAS.duracionCitaMin,
      estado: ESTADOS.AGENDADA,
      control,
      motivo: motivo || { sintomas: [], desde: null },
      pago: pago || { modo:'seguro', seguroId:null, monto:0, estado:'na' },
      claveIdem: claveIdem || null,
      creada: Date.now(),
      actualizada: Date.now(),
      cambios: 0,
      checkIn: null,
      notificacion: { estado:'pendiente', intentos:0, error:null, ts:null }
    };
    datos.citas.push(cita);
    anotar(datos, 'cita.reservar', cita.codigo + ' ' + fecha + ' ' + hora);
    return { ok:true, cita };
  });
}

/* ------------------------------------------------------------
   REPROGRAMAR
   ------------------------------------------------------------ */
export function reprogramar({ citaId, fecha, hora, usuarioId }){
  return transaccion((datos) => {
    const cita = datos.citas.find(c => c.id === citaId);
    if (!cita) return { abortar:true, ok:false, error:'No encontramos esa cita' };
    if (!mismaCuenta(cita, usuarioId)) return { abortar:true, ok:false, codigo:'ajena', error:'Esa cita no es tuya' };
    if (cita.estado !== ESTADOS.AGENDADA)
      return { abortar:true, ok:false, error:'Solo se pueden cambiar las citas agendadas' };

    if (horasFaltantes(cita.fecha, cita.hora) < REGLAS.horasMinimasParaCambiar)
      return { abortar:true, ok:false, codigo:'tarde',
               error:'Faltan menos de ' + REGLAS.horasMinimasParaCambiar + ' horas: llamá a la clínica al ' + '2200-1000' };

    if (esPasado(fecha, hora)) return { abortar:true, ok:false, error:'Ese horario ya pasó' };

    const choque = datos.citas.some(c =>
      c.id !== citaId && c.medicoId === cita.medicoId && c.fecha === fecha && c.hora === hora &&
      ESTADO_ACTIVO.includes(c.estado));
    if (choque || tomadoPorOtro(cita.medicoId, fecha, hora))
      return { abortar:true, ok:false, codigo:'horario-ocupado', error:'Ese horario ya está tomado' };

    const antes = { fecha: cita.fecha, hora: cita.hora };
    cita.fecha = fecha;
    cita.hora = hora;
    cita.cambios += 1;
    cita.actualizada = Date.now();
    cita.notificacion = { estado:'pendiente', intentos:0, error:null, ts:null };
    anotar(datos, 'cita.reprogramar', cita.codigo + ' ' + antes.fecha + ' ' + antes.hora + ' -> ' + fecha + ' ' + hora);
    return { ok:true, cita, antes };
  });
}

/* ------------------------------------------------------------
   CANCELAR (libera el horario)
   ------------------------------------------------------------ */
export function cancelar({ citaId, usuarioId, razon }){
  return transaccion((datos) => {
    const cita = datos.citas.find(c => c.id === citaId);
    if (!cita) return { abortar:true, ok:false, error:'No encontramos esa cita' };
    if (!mismaCuenta(cita, usuarioId)) return { abortar:true, ok:false, codigo:'ajena', error:'Esa cita no es tuya' };
    if (cita.estado === ESTADOS.CANCELADA) return { abortar:true, ok:true, cita, repetida:true };
    if (cita.estado === ESTADOS.ATENDIDA)
      return { abortar:true, ok:false, error:'Esa consulta ya se realizó' };

    cita.estado = ESTADOS.CANCELADA;
    cita.canceladaEn = Date.now();
    cita.razonCancelacion = razon || null;
    cita.actualizada = Date.now();
    cita.notificacion = { estado:'pendiente', intentos:0, error:null, ts:null };
    anotar(datos, 'cita.cancelar', cita.codigo);
    return { ok:true, cita };
  });
}

/* ------------------------------------------------------------
   CHECK-IN con el QR de la cita
   Reglas: existe, es tuya, no esta cancelada, no se usa dos veces
   y solo dentro de la ventana de llegada.
   ------------------------------------------------------------ */
export const VENTANA_CHECKIN_MIN = { antes: 120, despues: 30 };

export function checkIn({ codigo, usuarioId }){
  return transaccion((datos) => {
    const cita = datos.citas.find(c => c.codigo === codigo);
    if (!cita) return { abortar:true, ok:false, codigo:'no-existe', error:'Ese código no corresponde a ninguna cita' };
    if (!mismaCuenta(cita, usuarioId))
      return { abortar:true, ok:false, codigo:'ajena', error:'Ese pase es de otra cuenta' };
    if (cita.estado === ESTADOS.CANCELADA)
      return { abortar:true, ok:false, codigo:'cancelada', error:'Esa cita está cancelada: el pase ya no sirve' };
    if (cita.checkIn)
      return { abortar:true, ok:false, codigo:'usado', error:'Este pase ya se usó a las ' + new Date(cita.checkIn).toLocaleTimeString('es-SV', { hour:'2-digit', minute:'2-digit' }) };
    if (cita.estado === ESTADOS.ATENDIDA)
      return { abortar:true, ok:false, codigo:'atendida', error:'Esa consulta ya terminó' };

    const faltanMin = horasFaltantes(cita.fecha, cita.hora) * 60;
    if (faltanMin > VENTANA_CHECKIN_MIN.antes)
      return { abortar:true, ok:false, codigo:'temprano',
               error:'Todavía es temprano: el pase se activa 2 horas antes de tu cita' };
    if (faltanMin < -VENTANA_CHECKIN_MIN.despues)
      return { abortar:true, ok:false, codigo:'tarde',
               error:'Pasaron más de 30 minutos de tu hora. Acercate a recepción.' };

    cita.estado = ESTADOS.EN_SALA;
    cita.checkIn = Date.now();
    cita.actualizada = Date.now();
    anotar(datos, 'cita.checkin', cita.codigo);
    return { ok:true, cita };
  });
}

/** Cambio de estado interno (sala -> consulta -> atendida) */
export function cambiarEstado({ citaId, estado, usuarioId, extra }){
  return transaccion((datos) => {
    const cita = datos.citas.find(c => c.id === citaId);
    if (!cita) return { abortar:true, ok:false, error:'No encontramos esa cita' };
    if (!mismaCuenta(cita, usuarioId)) return { abortar:true, ok:false, error:'Esa cita no es tuya' };
    cita.estado = estado;
    if (extra) Object.assign(cita, extra);
    cita.actualizada = Date.now();
    anotar(datos, 'cita.estado', cita.codigo + ' -> ' + estado);
    return { ok:true, cita };
  });
}

/** Guarda como quedo el envio del correo (lo llama automatizacion.js) */
export function marcarNotificacion(citaId, notificacion){
  return transaccion((datos) => {
    const cita = datos.citas.find(c => c.id === citaId);
    if (!cita) return { abortar:true, ok:false };
    cita.notificacion = Object.assign({}, cita.notificacion, notificacion, { ts: Date.now() });
    return { ok:true, cita };
  });
}

/* ------------------------------------------------------------
   Al crear una cuenta, las citas que se hicieron como invitado
   pasan a esa cuenta. Asi nadie pierde lo que ya reservo.
   ------------------------------------------------------------ */
export function adoptarCitasDeInvitado(usuarioId){
  return transaccion((datos) => {
    let n = 0;
    datos.citas.forEach(c => {
      if (c.invitado && !c.usuarioId){ c.usuarioId = usuarioId; c.invitado = false; n++; }
    });
    if (n) anotar(datos, 'cita.adoptar', n + ' cita(s)');
    return { ok:true, adoptadas:n };
  });
}

/** Fecha que el medico sugiere para el control */
export const fechaControl = (cita) => {
  let f = sumarDias(cita.fecha, REGLAS.diasParaControl);
  while (esFinDeSemana(f)) f = sumarDias(f, 1);
  return f;
};

/** Resumen para el panel y las pruebas */
export function resumenAgenda(usuarioId){
  const todas = leer().citas;
  return {
    total: todas.length,
    mias: todas.filter(c => mismaCuenta(c, usuarioId)).length,
    activas: todas.filter(c => mismaCuenta(c, usuarioId) && ESTADO_ACTIVO.includes(c.estado)).length,
    canceladas: todas.filter(c => mismaCuenta(c, usuarioId) && c.estado === ESTADOS.CANCELADA).length
  };
}

export { diferenciaDias };
