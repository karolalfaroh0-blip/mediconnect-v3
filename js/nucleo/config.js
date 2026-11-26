/* ============================================================
   MediConnect · config.js
   Configuracion publica de la demo. AQUI NO VA NINGUN SECRETO:
   este archivo se publica tal cual en GitHub Pages y cualquiera
   puede leerlo desde el navegador.

   Lo que si va aqui: la zona horaria, la direccion publica de la
   app y la direccion del webhook de n8n (que es publica por
   diseno, igual que la direccion de un formulario).
   ============================================================ */

export const APP = {
  nombre: 'MediConnect',
  version: '3.0',
  /* Clinica ficticia de la demo */
  clinica: {
    nombre: 'Centro Médico MediConnect',
    telefono: '2200-1000',
    direccion: 'Paseo General Escalón, San Salvador',
    mapa: 'https://maps.google.com/?q=Paseo+General+Escalon+San+Salvador'
  }
};

/* ------------------------------------------------------------
   Zona horaria: un solo lugar para toda la app.
   El Salvador no cambia de hora en el ano, asi que el desfase
   es fijo (-6 horas). Si algun dia se usa otra zona, se cambia
   solo aqui y la app, el correo y el calendario siguen de acuerdo.
   ------------------------------------------------------------ */
export const ZONA = {
  id: 'America/El_Salvador',
  etiqueta: 'El Salvador · GMT-6',
  desfaseMin: -360,          // minutos respecto a UTC
  desfaseIso: '-06:00'
};

/* ------------------------------------------------------------
   Automatizaciones (n8n).
   `base` apunta al n8n Cloud personal del equipo (no es secreto:
   es una direccion publica, como la de un formulario). Ya no hace
   falta tunel: n8n Cloud tiene https propio y siempre encendido.
   Se puede cambiar sin tocar codigo en Perfil -> Ajustes de la demo,
   o por la direccion:  ?n8n=https://...
   Para volver al n8n local con tunel, deja '' aqui.
   ------------------------------------------------------------ */
export const N8N = {
  base: 'https://karolalfaro.app.n8n.cloud/webhook',
  rutas: {
    registro:     '/mediconnect/registro',
    reserva:      '/mediconnect/reserva',
    cambio:       '/mediconnect/cambio',
    cancelacion:  '/mediconnect/cancelacion',
    recordatorio: '/mediconnect/recordatorio'
  },
  tiempoLimiteMs: 12000,              // si tarda mas, se marca como "no confirmado"
  reintentos: 1
};

/* ------------------------------------------------------------
   Reglas del negocio (las usa la agenda).
   ------------------------------------------------------------ */
export const REGLAS = {
  duracionCitaMin: 30,
  diasVisibles: 5,                    // cuantos dias habiles muestra el selector rapido
  horasMinimasParaCambiar: 4,         // antes de la cita
  diasParaControl: 7,                 // el medico sugiere volver en una semana
  maxCitasActivasPorPaciente: 3,
  anticipacionMinimaHoras: 1          // no se puede reservar algo que empieza en menos de 1 h
};

/* ------------------------------------------------------------
   Claves de almacenamiento en el telefono.
   ------------------------------------------------------------ */
export const CLAVES = {
  datos: 'mediconnect:v3:datos',
  ajustes: 'mediconnect:v3:ajustes',
  sesion: 'mediconnect:v3:sesion'
};

/* ------------------------------------------------------------
   Parametros de la direccion (utiles para la exposicion):
     ?hoy=2026-11-25   finge que hoy es ese dia
     ?demo=0           esconde el panel del presentador
     ?demo=1           lo fuerza aunque sea un telefono
     ?n8n=https://...  configura el webhook sin tocar codigo
     ?cita=CODIGO      abre el comprobante de una cita
   ------------------------------------------------------------ */
export const PARAMS = new URLSearchParams(location.search);

/* Direccion publica de la app, calculada sola. Sirve para el QR. */
export function urlApp(){
  return location.origin + location.pathname.replace(/[^/]*$/, '');
}
