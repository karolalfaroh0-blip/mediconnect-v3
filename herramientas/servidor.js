/* ============================================================
   MediConnect · herramientas/servidor.js
   Servidor estatico minimo para probar la app en la computadora.

   Hace falta porque la app usa modulos de JavaScript (import/export)
   y los navegadores no los permiten al abrir el archivo con doble clic.

   Uso:   node herramientas/servidor.js [puerto]
   Luego: http://localhost:5500
   ============================================================ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// El proyecto es "type": "module", así que aquí no existe require ni __dirname
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.argv[2] || process.env.PORT || 5500);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.ics':  'text/calendar; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8'
};

const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta === '/' || ruta.endsWith('/')) ruta += 'index.html';

  const destino = path.join(RAIZ, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ''));

  // Nunca servir nada fuera de la carpeta del proyecto
  if (destino !== RAIZ && !destino.startsWith(RAIZ + path.sep)){
    res.writeHead(403).end('Prohibido');
    return;
  }

  fs.readFile(destino, (err, datos) => {
    if (err){
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>No existe <code>' + ruta.replace(/[<>&]/g, '') + '</code></p>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(datos);
  });
});

servidor.listen(PUERTO, () => {
  console.log('MediConnect en  http://localhost:' + PUERTO);
  console.log('Carpeta servida: ' + RAIZ);
  console.log('Para ver sin el panel del presentador: http://localhost:' + PUERTO + '/?demo=0');
});
