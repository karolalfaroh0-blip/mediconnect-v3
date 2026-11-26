/* ============================================================
   MediConnect · app.js
   El armazon: junta las pantallas, dibuja, escucha los toques
   y ajusta la maqueta al tamano de la pantalla.
   ============================================================ */

import { APP, PARAMS } from './nucleo/config.js';
import { S, registrarRender, ir, volver, tabear, abrirHoja, cerrarHoja,
         avisar, repintar, log, limpiarTemporizadores, usuario } from './nucleo/estado.js';
import { barraEstado, navegacion, esc } from './nucleo/ui.js';
import { simulacion, proximaCita, ESTADO_ACTIVO } from './nucleo/agenda.js';
import { leerAjustes } from './nucleo/almacen.js';
import { baseN8n, guardarBaseN8n } from './nucleo/automatizacion.js';

import * as pInicio from './pantallas/inicio.js';
import * as pAgendar from './pantallas/agendar.js';
import * as pCitas from './pantallas/citas.js';
import * as pCuenta from './pantallas/cuenta.js';
import * as pVisita from './pantallas/visita.js';
import * as pExpediente from './pantallas/expediente.js';
import * as pHojas from './pantallas/hojas.js';
import { renderPanel, conectarPanel } from './presentador.js';

window.__MC_VERSION__ = APP.version;

/* ------------------------------------------------------------
   Registros de pantallas y acciones
   ------------------------------------------------------------ */
const VISTAS = Object.assign({},
  pInicio.vistas, pAgendar.vistas, pCitas.vistas, pCuenta.vistas, pVisita.vistas, pExpediente.vistas);

const ACCIONES = Object.assign({},
  pInicio.acciones, pAgendar.acciones, pCitas.acciones, pCuenta.acciones,
  pVisita.acciones, pExpediente.acciones, pHojas.acciones, {
    volver(){ volver(); },
    aviso(v){ avisar(v); },
    cerrarHoja(){ cerrarHoja(); }
  });

const HOJAS = pHojas.hojas;

/* Nombre que escucha un lector de pantalla al abrirse cada hoja */
const ETIQUETA_HOJA = {
  sintomas: 'Tus síntomas',
  especialista: 'Elegir especialidad',
  elegirSeguro: 'Elegir seguro',
  agregarSeguro: 'Agregar un seguro',
  guardarCita: 'Cómo guardar tu cita',
  cambiar: 'Cambiar o cancelar la cita',
  cancelar: 'Confirmar la cancelación',
  calendario: 'Agregar al calendario',
  qr: 'Tu pase de llegada',
  examen: 'Detalle del examen',
  ayuda: 'Ayuda y preguntas',
  privacidad: 'Privacidad y datos',
  pagos: 'Métodos de pago',
  borrarDemo: 'Borrar los datos de la demo'
};

/* ------------------------------------------------------------
   Dibujo
   ------------------------------------------------------------ */
const dev = document.getElementById('dev');
let hojaAbierta = null;
let pestanaPrevia = null;
// Si algo intenta desplazar el contenedor del teléfono, vuelve a su lugar
dev.addEventListener('scroll', () => { if (dev.scrollTop || dev.scrollLeft){ dev.scrollTop = 0; dev.scrollLeft = 0; } });

function render(conAnimacion){
  const fn = VISTAS[S.pantalla] || VISTAS.inicio;
  const v = fn();

  // Se recuerda donde estaba el desplazamiento y el foco
  const pantallaPrevia = dev.querySelector('.screen');
  const scrollPrevio = !conAnimacion && pantallaPrevia ? pantallaPrevia.scrollTop : 0;
  const hojaPrevia = dev.querySelector('.sheet');
  const scrollHoja = !conAnimacion && hojaPrevia ? hojaPrevia.scrollTop : 0;
  const activo = document.activeElement;
  const foco = activo && activo.id && dev.contains(activo)
    ? { id: activo.id, pos: (() => { try { return activo.selectionStart; } catch(e){ return null; } })() }
    : null;

  dev.classList.toggle('dark', !!v.oscura);

  // La navegación y la barra de acción fija se estorban: solo una a la vez
  const llevaAccion = v.html.includes('data-fija="1"');
  const llevaNav = v.nav && !llevaAccion;
  dev.classList.toggle('con-nav', !!llevaNav);
  dev.classList.toggle('con-accion', llevaAccion);
  let html = barraEstado(v.oscura) + v.html + (llevaNav ? navegacion(v.nav, avisosDeNavegacion()) : '');

  if (S.hoja && HOJAS[S.hoja]){
    html += '<div class="scrim" data-act="cerrarHoja"></div>' +
            '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(ETIQUETA_HOJA[S.hoja] || 'Opciones') + '">' +
            HOJAS[S.hoja]() + '</div>';
  }

  dev.innerHTML = html;

  // El contenedor del teléfono nunca se desplaza: solo la pantalla de adentro.
  // (Un foco o un scrollIntoView podía correrlo y dejar la barra a media pantalla.)
  dev.scrollTop = 0; dev.scrollLeft = 0;

  const pantalla = dev.querySelector('.screen');
  if (pantalla){
    if (!conAnimacion){ pantalla.style.animation = 'none'; pantalla.scrollTop = scrollPrevio; }
    else {
      pantalla.classList.add('entra');               // los bloques aparecen en cascada
      if (S.atras) pantalla.classList.add('back');
    }
  }

  // El indicador de la pestaña se desliza desde la que estaba antes
  const nav = dev.querySelector('.nav');
  if (nav){
    const nueva = nav.style.getPropertyValue('--i');
    if (pestanaPrevia !== null && pestanaPrevia !== nueva){
      nav.style.setProperty('--i', pestanaPrevia);
      requestAnimationFrame(() => requestAnimationFrame(() => nav.style.setProperty('--i', nueva)));
    }
    pestanaPrevia = nueva;
  }

  const hoja = dev.querySelector('.sheet');
  if (hoja && hojaAbierta === S.hoja){
    hoja.style.animation = 'none';
    const scrim = dev.querySelector('.scrim');
    if (scrim) scrim.style.animation = 'none';
    hoja.scrollTop = scrollHoja;
  }
  hojaAbierta = S.hoja;

  // Devolver el foco a donde estaba
  if (foco){
    const el = document.getElementById(foco.id);
    if (el){
      el.focus({ preventScroll: true });
      if (foco.pos !== null){ try { el.setSelectionRange(foco.pos, foco.pos); } catch(e){} }
    }
  } else if (conAnimacion && hoja){
    // Al abrir una hoja, el foco entra en ella
    const primero = hoja.querySelector('input, button:not([disabled])');
    if (primero) primero.focus({ preventScroll: true });
  }

  // Llevar el foco a la sección que se pidió editar
  if (conAnimacion && S.pantalla === 'editar' && S.enfoquePerfil){
    const destino = S.enfoquePerfil;
    S.enfoquePerfil = null;
    setTimeout(() => {
      const el = document.getElementById('ed-' + destino) ||
                 document.getElementById('sec-' + destino);
      if (el){
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (el.tagName === 'INPUT') el.focus({ preventScroll: true });
      }
    }, 80);
  }

  if (S.aviso) pintarAviso();

  const titulo = document.getElementById('titulo-pantalla');
  if (titulo && v.titulo && conAnimacion) titulo.textContent = v.titulo;

  pVisita.programarAvances();
  renderPanel();
}

function pintarAviso(){
  dev.querySelectorAll('.toast').forEach(x => x.remove());
  if (!S.aviso) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (S.avisoTipo || '');
  t.style.animationDelay = '-' + Math.min(3.1, (Date.now() - S.avisoDesde) / 1000) + 's';
  t.textContent = S.aviso;
  dev.appendChild(t);
}

/** Puntitos de aviso en la barra de navegación */
function avisosDeNavegacion(){
  const u = usuario();
  const cita = proximaCita(u?.id || null);
  return { citas: !!cita };
}

registrarRender(render);

/* ------------------------------------------------------------
   Toques y clics
   ------------------------------------------------------------ */
dev.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;

  if (t.dataset.tab){
    const destino = t.dataset.tab;
    tabear(destino === 'citas' ? 'citas' : destino);
    return;
  }

  if (t.getAttribute('aria-disabled') === 'true') return;

  const accion = ACCIONES[t.dataset.act];
  if (!accion){
    console.warn('Acción sin definir:', t.dataset.act);
    return;
  }
  accion(t.dataset.v);
});

/* ------------------------------------------------------------
   Escritura en los campos
   ------------------------------------------------------------ */
const CAMPOS_QUE_REPINTAN = {
  q: (v) => { S.q = v; },
  symq: (v) => { S.sintomaQ = v; },
  specq: (v) => { S.especialidadQ = v; },
  insq: (v) => { S.agregarSeguro.q = v; },
  insp: (v) => { S.agregarSeguro.poliza = v; }
};

dev.addEventListener('input', (e) => {
  const id = e.target.id;
  const valor = e.target.value;
  if (!id) return;

  if (CAMPOS_QUE_REPINTAN[id]){ CAMPOS_QUE_REPINTAN[id](valor); repintar(); return; }

  if (id === 'sendnote'){ S.notaEnvio = valor; return; }
  if (id === 'aj-n8n'){ S.ajustesBorrador = Object.assign(S.ajustesBorrador || leerAjustes(), { n8nBase: valor }); return; }

  if (id.startsWith('f-')){
    const clave = id.slice(2);
    S.auth[clave] = valor;
    if (S.auth.errores[clave]){ delete S.auth.errores[clave]; repintar(); }
    return;
  }

  if (id.startsWith('ed-') && S.borrador){
    const clave = id.slice(3);
    S.borrador[clave] = valor;
    if (S.erroresPerfil[clave]){ delete S.erroresPerfil[clave]; repintar(); }
  }
});

/* Enter dentro de un campo: avanza en vez de recargar */
dev.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const id = e.target.id;
  if (id === 'symq' && S.sintomaQ.trim()){ e.preventDefault(); ACCIONES.agregarSintoma(); return; }
  if (id && id.startsWith('f-')){ e.preventDefault(); ACCIONES.enviarAuth(); return; }
  if (id === 'insp'){ e.preventDefault(); ACCIONES.guardarSeguro(); }
});

/* Escape cierra la hoja abierta */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.hoja){ cerrarHoja(); }
});

/* ------------------------------------------------------------
   Ajuste de la maqueta
   ------------------------------------------------------------ */
function ajustar(){
  const B = document.body;
  const demo = PARAMS.get('demo');

  const esTelefono = innerWidth <= 480 ||
    (matchMedia('(pointer:coarse)').matches && Math.min(innerWidth, innerHeight) <= 820);

  B.classList.toggle('native', esTelefono);
  B.classList.toggle('nopanel', demo === '0' || (esTelefono && demo !== '1'));

  const anclado = !esTelefono && demo !== '0' && innerWidth >= 1100;
  B.classList.toggle('drawer', !anclado && !B.classList.contains('nopanel'));

  const envoltura = document.getElementById('phoneWrap');
  const telefono = document.getElementById('phone');
  if (esTelefono){
    telefono.style.transform = '';
    envoltura.style.width = '';
    envoltura.style.height = '';
    return;
  }

  const anchoDisponible = innerWidth - 48 - (anclado ? 368 + 48 : 0);
  const altoDisponible = innerHeight - 64;
  const escala = Math.min(1.15, altoDisponible / 876, anchoDisponible / 422);
  telefono.style.transform = 'scale(' + escala + ')';
  envoltura.style.width = (422 * escala) + 'px';
  envoltura.style.height = (876 * escala) + 'px';
}

addEventListener('resize', ajustar);
addEventListener('orientationchange', () => setTimeout(ajustar, 150));

/* ------------------------------------------------------------
   Teclado del telefono: que no tape el boton principal
   ------------------------------------------------------------ */
function seguirTeclado(){
  const vv = window.visualViewport;
  if (!vv) return;
  const actualizar = () => {
    // Solo cuenta como teclado si hay un campo de texto con el foco y lo tapado es grande:
    // las barras de Safari también achican la vista y no son teclado.
    const a = document.activeElement;
    const escribiendo = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    const tapado = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    const teclado = escribiendo && tapado > 120 ? Math.round(tapado) : 0;
    document.documentElement.style.setProperty('--teclado', teclado + 'px');
  };
  addEventListener('focusin', () => setTimeout(actualizar, 50));
  addEventListener('focusout', () => setTimeout(actualizar, 50));
  vv.addEventListener('resize', actualizar);
  vv.addEventListener('scroll', actualizar);
  actualizar();
}

/* ------------------------------------------------------------
   Arranque
   ------------------------------------------------------------ */
function arrancar(){
  // Configuración del webhook por la dirección (?n8n=…): se guarda para las próximas visitas
  const porUrl = PARAMS.get('n8n');
  if (porUrl) guardarBaseN8n(porUrl);

  simulacion.diaSinCupos = S.demo.sinCupos;

  // Si ya hay sesión abierta, se entra directo a Inicio
  const u = usuario();
  if (u){
    S.pantalla = 'inicio';
    S.seguroElegido = (u.seguros.find(s => s.principal) || u.seguros[0] || {}).id || null;
    log('sesión abierta · ' + u.perfil.correo);
  } else {
    log('sin sesión · exploración como invitado');
  }

  if (baseN8n()) log('automatización conectada · ' + baseN8n());
  else log('automatización sin configurar · la app funciona igual');

  conectarPanel(() => {
    // Botón "avanzar" del panel
    limpiarTemporizadores();
    if (S.pantalla === 'sala'){
      if (S.turno > 0){ S.turno--; log('fila.avanzar() → quedan ' + S.turno); repintar(); }
      else ACCIONES.entrarConsulta();
    } else if (S.pantalla === 'lab'){
      if (S.pasoLab < 3){ S.pasoLab++; log('laboratorio.paso = ' + S.pasoLab); repintar(); }
      else ACCIONES.volverDeLab();
    } else {
      pVisita.decidirConsulta();
    }
  });

  ajustar();
  seguirTeclado();
  render(true);
}

arrancar();
