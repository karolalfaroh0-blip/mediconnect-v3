/* ============================================================
   MediConnect · herramientas/generar-qr.js
   Genera el QR público: el que los docentes escanean para abrir
   la app desde su teléfono.

   Usa el MISMO generador que la app (js/nucleo/qr.js), así que lo
   que se imprime es exactamente lo que se ve en pantalla.

   Uso:
     node herramientas/generar-qr.js https://tu-usuario.github.io/mediconnect/
     node herramientas/generar-qr.js            (lee MC_URL_PUBLICA del entorno)

   Deja dos archivos en assets/:
     · qr-publico.svg    para imprimir o proyectar (no pierde nitidez)
     · qr-publico.html   una hoja lista para imprimir, con el QR y la dirección
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

// El módulo de QR no toca el navegador, pero config.js sí lee `location`
globalThis.location = { search: '', origin: 'https://ejemplo', pathname: '/' };
const { svg, generar } = await import('../js/nucleo/qr.js');

const url = process.argv[2] || process.env.MC_URL_PUBLICA;

if (!url){
  console.error(`
Falta la dirección pública.

  node herramientas/generar-qr.js https://tu-usuario.github.io/mediconnect/

Si todavía no publicaste el sitio, mirá docs/05-publicar.md.
`);
  process.exit(1);
}

if (!/^https?:\/\//i.test(url)){
  console.error('La dirección tiene que empezar con https://');
  process.exit(1);
}

const info = generar(url, { nivel: 'M' });
const dibujo = svg(url, { tamano: 900, nivel: 'M', titulo: 'Abrí MediConnect: ' + url });

const carpeta = path.join(RAIZ, 'assets');
fs.mkdirSync(carpeta, { recursive: true });
fs.writeFileSync(path.join(carpeta, 'qr-publico.svg'), dibujo, 'utf8');

const hoja = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>QR de MediConnect</title>
<style>
  @page { size: A4; margin: 18mm; }
  body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111214;
       display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:22px;text-align:center}
  .marca{display:flex;align-items:center;gap:10px;font-weight:600;font-size:18px}
  .marca i{width:30px;height:30px;border-radius:9px;background:#3B5BF6;display:grid;place-items:center;color:#fff;font-style:normal}
  h1{font-size:34px;line-height:40px;font-weight:400;letter-spacing:-1px;margin:0;max-width:16ch}
  p{color:#5B6069;font-size:16px;margin:0;max-width:40ch;line-height:24px}
  .qr{padding:18px;background:#fff;border-radius:22px;box-shadow:0 0 0 1px #E2E5EA}
  .qr svg{width:300px;height:300px;display:block}
  code{font-size:14px;background:#F2F3F5;padding:8px 14px;border-radius:999px;word-break:break-all;display:inline-block}
  .pie{font-size:12px;color:#7A7F88;max-width:48ch;line-height:18px}
  @media print{ body{min-height:auto;padding-top:20mm} .qr{box-shadow:none;border:1px solid #E2E5EA} }
</style></head>
<body>
  <div class="marca"><i>+</i>MediConnect</div>
  <h1>Escaneá y probalo en tu teléfono</h1>
  <p>Apuntá la cámara al código. No hace falta instalar nada ni registrarse para empezar.</p>
  <div class="qr">${dibujo.replace(/width="900" height="900"/, '')}</div>
  <code>${url.replace(/[<>&]/g, '')}</code>
  <p class="pie">Prototipo académico de Lógica de Programación y Desarrollo Web ·
  David Guardado, Karol Alfaro, Kiyomi Alfaro y Caleb Galán.
  La clínica, los médicos y los pagos son ficticios.</p>
</body></html>
`;
fs.writeFileSync(path.join(carpeta, 'qr-publico.html'), hoja, 'utf8');

console.log(`
QR generado para:  ${url}
  versión ${info.version} · ${info.lado}×${info.lado} módulos · corrección M (recupera ~15 %)

  assets/qr-publico.svg     para proyectar o pegar en la presentación
  assets/qr-publico.html    hoja lista para imprimir (abrila e imprimí)

Antes de la exposición, escanealo con tu propio teléfono y comprobá que abra la app.
`);
