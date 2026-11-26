/* ============================================================
   MediConnect · pantallas/expediente.js
   Resultados, medicinas y farmacias.

   Todo este expediente es CONTENIDO DE EJEMPLO. Sirve para mostrar
   como se veria la historia clinica digital; no guarda ni pide
   datos medicos reales de nadie.
   ============================================================ */

import { ic, esc, encabezado, monograma, simulado, interruptor } from '../nucleo/ui.js';
import { S, tabear, abrirHoja, avisar, repintar, usuario } from '../nucleo/estado.js';
import { examenes, farmacias, medico } from '../nucleo/datos.js';

export const vistas = {};

vistas.expediente = () => {
  const t = S.pestanaExpediente;
  let cuerpo = '';

  if (t === 'Resultados'){
    cuerpo =
      '<button class="card tap" data-act="verExamen" data-v="bp" style="gap:10px;text-align:left">' +
      '<div class="row" style="gap:8px"><span class="ct">Presión arterial</span>' +
      '<span class="badge" style="background:var(--ok-soft);color:var(--ok)">Normal</span>' +
      '<span class="grow"></span><span class="cap mute">12 sep</span></div>' +
      '<div class="row" style="align-items:flex-end">' +
      '<span class="row" style="gap:6px;align-items:baseline"><span class="hero">118/76</span>' +
      '<span class="cap mute">mmHg</span></span><span class="grow"></span>' +
      '<span class="bars">' + [22, 30, 26, 36, 28, 32, 44].map((h, i) =>
        '<i style="height:' + h + 'px" class="' + (i === 6 ? 'on' : '') + '"></i>').join('') + '</span></div></button>' +

      '<div class="card list">' +
      [['hemo', 'Hemograma completo', '20 ago', 'Normal', 'okp'],
       ['lip', 'Perfil lipídico', '20 ago', 'Revisar', 'warnp'],
       ['glu', 'Glucosa en ayunas', '20 ago', 'Normal', 'okp']
      ].map((x, i, a) => {
        const enviado = S.enviados[x[0]];
        return '<button class="li tap" data-act="verExamen" data-v="' + x[0] + '" style="text-align:left">' +
          '<span class="cb s40 field">' + ic('flask', 18) + '</span>' +
          '<span class="grow stack" style="gap:2px"><span class="bm">' + x[1] + '</span>' +
          '<span class="cap mute">' + x[2] + (enviado ? ' · enviado a ' + esc(medico(enviado).n) : '') + '</span></span>' +
          '<span class="pill sm ' + x[4] + '">' + x[3] + '</span></button>' +
          (i < a.length - 1 ? '<div class="sep" style="margin:0 12px"></div>' : '');
      }).join('') + '</div>' +

      '<button class="card dark tap" data-act="verFarmacias" ' +
      'style="flex-direction:row;align-items:center;gap:12px;text-align:left">' +
      '<span class="gridbg"></span>' +
      '<span class="content grow stack" style="gap:4px"><span class="ct">Farmacias cerca</span>' +
      '<span class="cap dim">5 a menos de 5 km de vos</span></span>' +
      '<span class="content cb s44 fill" style="color:var(--ink)">' + ic('navigate', 18) + '</span></button>';

  } else if (t === 'Medicinas'){
    cuerpo =
      '<div class="card" style="gap:14px">' +
      '<div class="row" style="gap:8px"><span class="ct">Tus medicinas</span>' +
      '<span class="badge">' + (2 + (S.visitaTerminada ? 1 : 0)) + '</span></div>' +
      [['Loratadina 10 mg', '1 al día · 8:00 a. m.'], ['Atorvastatina 20 mg', '1 en la noche · 9:00 p. m.']]
        .map((m, i) => '<div class="row"><span class="cb s40 field">' + ic('pill', 18) + '</span>' +
          '<div class="grow stack" style="gap:2px"><span class="bm">' + m[0] + '</span>' +
          '<span class="cap mute">' + m[1] + '</span></div>' +
          interruptor(S.medicinas[i], 'medicina', i, 'Recordatorio de ' + m[0]) + '</div>').join('') +
      (S.visitaTerminada
        ? '<div class="sep"></div><div class="row"><span class="cb s40 ok">' + ic('pill', 18) + '</span>' +
          '<div class="grow stack" style="gap:2px"><span class="bm">Ibuprofeno 400 mg</span>' +
          '<span class="cap mute">Cada 8 horas · 3 días · nueva</span></div>' +
          '<span class="pill sm okp">En farmacia</span></div>'
        : '') + '</div>' +

      '<div class="card soft" style="flex-direction:row;align-items:center;gap:12px">' +
      '<span class="cb s44 brand">' + ic('bell') + '</span>' +
      '<div class="grow stack" style="gap:2px"><span class="ct">Te recordamos cada toma</span>' +
      '<span class="cap mute">Activá o apagá cada medicina</span></div></div>';

  } else {
    cuerpo =
      '<div class="map">' +
      '<svg width="100%" height="100%" viewBox="0 0 350 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="350" height="180" fill="#E9ECF1"/>' +
      '<g stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" fill="none">' +
      '<path d="M-10 60 C80 50 160 90 360 70"/><path d="M-10 140 C90 120 200 150 360 120"/>' +
      '<path d="M90 -10 C100 60 80 120 110 200"/><path d="M240 -10 C230 70 260 120 250 200"/></g>' +
      '<g stroke="#FFFFFF" stroke-width="4" fill="none" opacity=".8"><path d="M0 100 H350"/><path d="M170 0 V180"/></g>' +
      '<rect x="185" y="80" width="40" height="30" rx="8" fill="#DDEEDB"/>' +
      '<rect x="30" y="80" width="40" height="28" rx="8" fill="#DDEEDB"/></svg>' +
      farmacias.map((p, i) =>
        '<span style="position:absolute;left:' + p.x + '%;top:' + p.y + '%;transform:translate(-50%,-50%);' +
        'width:' + (i ? 26 : 32) + 'px;height:' + (i ? 26 : 32) + 'px;border-radius:50%;' +
        'background:' + (i ? 'var(--dark)' : 'var(--brand)') + ';color:#fff;display:grid;place-items:center;' +
        'font-size:11px;font-weight:600;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.18)">' + (i + 1) + '</span>').join('') +
      '<span style="position:absolute;left:46%;top:52%;width:16px;height:16px;border-radius:50%;' +
      'background:var(--brand);border:3px solid #fff;box-shadow:0 0 0 8px rgba(59,91,246,.18)"></span></div>' +

      '<div class="card list">' + farmacias.map((p, i, a) =>
        '<button class="li tap" data-act="rutaFarmacia" data-v="' + esc(p.n) + '" style="text-align:left">' +
        monograma(p.m, i ? 'field' : 'bsoft', 40) +
        '<span class="grow stack" style="gap:2px"><span class="bm">' + (i + 1) + '. ' + esc(p.n) + '</span>' +
        '<span class="cap mute">' + esc(p.s) + '</span></span>' +
        '<span class="label mute">' + p.km + '</span></button>' +
        (i < a.length - 1 ? '<div class="sep" style="margin:0 12px"></div>' : '')).join('') + '</div>';
  }

  return {
    nav: 'expediente',
    titulo: 'Expediente',
    html:
      '<div class="screen"><div class="stack">' +
      encabezado('Expediente', 'Tu salud,<br>todo en un lugar') +

      '<div class="card p16" style="gap:8px"><div class="row top">' +
      '<span class="mute">' + ic('info', 18) + '</span>' +
      '<span class="cap mute grow">Resultados, medicinas y farmacias son <b>contenido de ejemplo</b>. ' +
      'Esta demo no guarda información médica real.</span>' + simulado('Ejemplo') + '</div></div>' +

      '<div class="chips" role="group" aria-label="Secciones del expediente">' +
      ['Resultados', 'Medicinas', 'Farmacias'].map(c =>
        '<button class="pill h40 ' + (t === c ? 'darkp' : 'white') + '" data-act="pestanaExp" data-v="' + c + '" ' +
        'aria-pressed="' + (t === c) + '">' + c + '</button>').join('') + '</div>' +

      cuerpo + '</div></div>'
  };
};

export const acciones = {
  pestanaExp(v){
    S.pestanaExpediente = v;
    if (S.pantalla !== 'expediente') tabear('expediente');
    else repintar();
  },
  verExamen(v){
    S.examenId = v;
    S.enviarA = examenes[v].by;
    S.notaEnvio = '';
    abrirHoja('examen');
  },
  rutaFarmacia(v){ avisar('Abriendo la ruta a ' + v); },
  medicina(v){ S.medicinas[+v] = !S.medicinas[+v]; repintar(); }
};
