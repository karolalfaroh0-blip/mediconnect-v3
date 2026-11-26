/* ============================================================
   MediConnect · qr.js
   Generador de codigos QR de verdad (norma ISO/IEC 18004,
   modelo 2, modo byte). Escrito a mano, sin librerias, para que
   la app funcione aunque el aula no tenga internet.

   Como funciona, en corto:
     1. El texto se convierte a bytes y se le pegan unas cabeceras.
     2. Se calculan codigos de correccion de errores Reed-Solomon,
        que son los que permiten leer el QR aunque este rayado.
     3. Los bits se acomodan en zigzag sobre una cuadricula.
     4. Se prueban 8 "mascaras" y se elige la que deja el dibujo
        menos confuso para la camara.

   Es un buen ejemplo de ciclos, matrices y funciones puras.
   ============================================================ */

/* ------------------------------------------------------------
   Tablas de la norma
   ------------------------------------------------------------ */

/* Codewords de correccion por bloque, segun version (1..40) y nivel */
const EC_POR_BLOQUE = {
  L:[-1, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  M:[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  Q:[-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  H:[-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
};

/* Cuantos bloques de correccion lleva cada version y nivel */
const BLOQUES_EC = {
  L:[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  M:[-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  Q:[-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  H:[-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
};

/* Bits que identifican el nivel de correccion dentro del formato */
const BITS_NIVEL = { L:1, M:0, Q:3, H:2 };

/* ------------------------------------------------------------
   Aritmetica en el campo de Galois GF(256) · polinomio 0x11D
   Es la "matematica" que hace posible la correccion de errores.
   ------------------------------------------------------------ */
function multiplicarGF(x, y){
  let z = 0;
  for (let i = 7; i >= 0; i--){
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

/** Polinomio divisor de grado `grado` para Reed-Solomon */
function divisorRS(grado){
  const r = new Uint8Array(grado);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++){
    for (let j = 0; j < grado; j++){
      r[j] = multiplicarGF(r[j], raiz);
      if (j + 1 < grado) r[j] ^= r[j + 1];
    }
    raiz = multiplicarGF(raiz, 0x02);
  }
  return r;
}

/** Resto de dividir los datos entre el divisor: son los codewords de correccion */
function restoRS(datos, divisor){
  const r = new Uint8Array(divisor.length);
  for (const b of datos){
    const factor = b ^ r[0];
    r.copyWithin(0, 1);
    r[r.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) r[i] ^= multiplicarGF(divisor[i], factor);
  }
  return r;
}

/* ------------------------------------------------------------
   Cuantos modulos de datos caben en cada version
   ------------------------------------------------------------ */
function modulosDeDatos(version){
  const lado = version * 4 + 17;
  let n = lado * lado;
  n -= 8 * 8 * 3;              // los tres cuadros grandes de las esquinas y sus separadores
  n -= 15 * 2 + 1;             // la informacion de formato y el modulo oscuro fijo
  n -= (lado - 16) * 2;        // las lineas de sincronia
  if (version >= 2){
    const na = Math.floor(version / 7) + 2;
    n -= (na - 1) * (na - 1) * 25;
    n -= (na - 2) * 2 * 20;
    if (version >= 7) n -= 6 * 3 * 2;   // informacion de version
  }
  return n;
}

const codewordsTotales = (v) => Math.floor(modulosDeDatos(v) / 8);
const codewordsDeDatos = (v, nivel) =>
  codewordsTotales(v) - EC_POR_BLOQUE[nivel][v] * BLOQUES_EC[nivel][v];

/** Donde van los cuadritos de alineacion */
function posicionesAlineacion(version){
  if (version === 1) return [];
  const cuantos = Math.floor(version / 7) + 2;
  const lado = version * 4 + 17;
  const paso = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (cuantos * 2 - 2)) * 2;
  // La primera posicion siempre es 6; las demas se cuentan desde el final
  // hacia atras y se insertan DESPUES del 6, para que la lista quede en
  // orden ascendente (de esto depende que se salten las tres esquinas).
  const r = [6];
  for (let pos = lado - 7; r.length < cuantos; pos -= paso) r.splice(1, 0, pos);
  return r;
}

/* ------------------------------------------------------------
   Armado de los bits de datos (modo byte)
   ------------------------------------------------------------ */
function aBytes(texto){
  return Array.from(new TextEncoder().encode(texto));
}

function bitsDeDatos(bytes, version){
  const bits = [];
  const empujar = (valor, cuantos) => {
    for (let i = cuantos - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  empujar(0b0100, 4);                                   // modo byte
  empujar(bytes.length, version <= 9 ? 8 : 16);         // cuantos caracteres
  for (const b of bytes) empujar(b, 8);
  return bits;
}

/** Elige la version mas pequena donde quepa el texto */
function elegirVersion(bytes, nivel, maxVersion){
  for (let v = 1; v <= maxVersion; v++){
    const capacidadBits = codewordsDeDatos(v, nivel) * 8;
    const necesita = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
    if (necesita <= capacidadBits) return v;
  }
  return null;
}

/* ------------------------------------------------------------
   Datos -> codewords (con relleno) -> bloques con correccion
   ------------------------------------------------------------ */
function codewordsConCorreccion(bits, version, nivel){
  const capacidad = codewordsDeDatos(version, nivel) * 8;

  // terminador: hasta 4 ceros
  for (let i = 0; i < 4 && bits.length < capacidad; i++) bits.push(0);
  // completar el byte
  while (bits.length % 8 !== 0 && bits.length < capacidad) bits.push(0);

  const datos = [];
  for (let i = 0; i < bits.length; i += 8){
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    datos.push(b);
  }
  // relleno alternando 11101100 y 00010001
  const relleno = [0xEC, 0x11];
  let k = 0;
  while (datos.length < capacidad / 8) datos.push(relleno[k++ % 2]);

  // reparto en bloques
  const nBloques = BLOQUES_EC[nivel][version];
  const ecPorBloque = EC_POR_BLOQUE[nivel][version];
  const total = codewordsTotales(version);
  const cortos = nBloques - (total % nBloques);
  const largoCorto = Math.floor(total / nBloques);
  const divisor = divisorRS(ecPorBloque);

  const bloquesDatos = [];
  const bloquesEc = [];
  let i = 0;
  for (let b = 0; b < nBloques; b++){
    const largoDatos = largoCorto - ecPorBloque + (b < cortos ? 0 : 1);
    const trozo = datos.slice(i, i + largoDatos);
    i += largoDatos;
    bloquesDatos.push(trozo);
    bloquesEc.push(restoRS(trozo, divisor));
  }

  // intercalado: primero los datos columna a columna, luego la correccion
  const salida = [];
  const maxDatos = Math.max(...bloquesDatos.map(b => b.length));
  for (let j = 0; j < maxDatos; j++)
    for (const b of bloquesDatos) if (j < b.length) salida.push(b[j]);
  for (let j = 0; j < ecPorBloque; j++)
    for (const b of bloquesEc) salida.push(b[j]);

  return salida;
}

/* ------------------------------------------------------------
   Dibujo de la cuadricula
   ------------------------------------------------------------ */
function nuevaMatriz(lado, valor){
  return Array.from({ length: lado }, () => new Array(lado).fill(valor));
}

function dibujarPatronesFijos(m, fn, version){
  const lado = m.length;
  const poner = (x, y, oscuro) => {
    if (x < 0 || y < 0 || x >= lado || y >= lado) return;
    m[y][x] = oscuro; fn[y][x] = true;
  };

  // lineas de sincronia
  for (let i = 0; i < lado; i++){ poner(6, i, i % 2 === 0); poner(i, 6, i % 2 === 0); }

  // los tres cuadros de las esquinas (y su separador blanco)
  const cuadro = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++){
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        poner(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  };
  cuadro(3, 3); cuadro(lado - 4, 3); cuadro(3, lado - 4);

  // cuadritos de alineacion
  const pos = posicionesAlineacion(version);
  for (let a = 0; a < pos.length; a++)
    for (let b = 0; b < pos.length; b++){
      const esEsquina = (a === 0 && b === 0) || (a === 0 && b === pos.length - 1) || (a === pos.length - 1 && b === 0);
      if (esEsquina) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          poner(pos[a] + dx, pos[b] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

  // reserva de la informacion de version (version 7 en adelante)
  if (version >= 7){
    let resto = version;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1F25);
    const bits = (version << 12) | resto;
    for (let i = 0; i < 18; i++){
      const bit = ((bits >>> i) & 1) === 1;
      const a = lado - 11 + (i % 3), b = Math.floor(i / 3);
      poner(a, b, bit); poner(b, a, bit);
    }
  }
}

function dibujarFormato(m, fn, nivel, mascara){
  const lado = m.length;
  const poner = (x, y, oscuro) => { m[y][x] = oscuro; fn[y][x] = true; };

  const datos = (BITS_NIVEL[nivel] << 3) | mascara;
  let resto = datos;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  const bits = ((datos << 10) | resto) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) poner(8, i, bit(i));
  poner(8, 7, bit(6));
  poner(8, 8, bit(7));
  poner(7, 8, bit(8));
  for (let i = 9; i < 15; i++) poner(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) poner(lado - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) poner(8, lado - 15 + i, bit(i));
  poner(8, lado - 8, true);              // el modulo oscuro que siempre esta
}

function colocarDatos(m, fn, codewords){
  const lado = m.length;
  let i = 0;
  for (let derecha = lado - 1; derecha >= 1; derecha -= 2){
    if (derecha === 6) derecha = 5;      // la columna 6 es de sincronia, se salta
    for (let v = 0; v < lado; v++){
      for (let j = 0; j < 2; j++){
        const x = derecha - j;
        const haciaArriba = ((derecha + 1) & 2) === 0;
        const y = haciaArriba ? lado - 1 - v : v;
        if (!fn[y][x] && i < codewords.length * 8){
          m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
}

const CONDICION_MASCARA = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
];

function aplicarMascara(m, fn, mascara){
  const cond = CONDICION_MASCARA[mascara];
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++)
      if (!fn[y][x] && cond(x, y)) m[y][x] = !m[y][x];
}

/* Penalizacion: mide que tan confuso queda el dibujo para la camara */
function penalizacion(m){
  const n = m.length;
  let p = 0;

  const corrida = (obtener) => {
    for (let a = 0; a < n; a++){
      let color = obtener(a, 0), largo = 1;
      const historia = [];
      for (let b = 1; b < n; b++){
        const c = obtener(a, b);
        if (c === color){ largo++; }
        else {
          if (largo >= 5) p += 3 + (largo - 5);
          historia.push({ color, largo });
          color = c; largo = 1;
        }
      }
      if (largo >= 5) p += 3 + (largo - 5);
      historia.push({ color, largo });
      // regla 3: patron 1:1:3:1:1 rodeado de 4 claros
      for (let i = 0; i + 4 < historia.length; i++){
        const h = historia.slice(i, i + 5);
        if (h[0].color && !h[1].color && h[2].color && !h[3].color && h[4].color){
          const u = h[0].largo;
          if (h[1].largo === u && h[2].largo === 3 * u && h[3].largo === u && h[4].largo === u){
            const antes = i > 0 ? historia[i - 1] : null;
            const despues = i + 5 < historia.length ? historia[i + 5] : null;
            if ((antes && !antes.color && antes.largo >= 4 * u) || (despues && !despues.color && despues.largo >= 4 * u)) p += 40;
          }
        }
      }
    }
  };
  corrida((y, x) => m[y][x]);            // filas
  corrida((x, y) => m[y][x]);            // columnas

  // regla 2: bloques de 2x2 del mismo color
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++){
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }

  // regla 4: proporcion de modulos oscuros
  let oscuros = 0;
  for (const fila of m) for (const c of fila) if (c) oscuros++;
  const total = n * n;
  const k = Math.ceil(Math.abs(oscuros * 20 - total * 10) / total) - 1;
  p += k * 10;

  return p;
}

/* ------------------------------------------------------------
   API publica
   ------------------------------------------------------------ */

/**
 * Genera la matriz de un QR.
 * @returns { matriz: boolean[][], lado, version, nivel }
 */
export function generar(texto, { nivel = 'M', maxVersion = 20 } = {}){
  const bytes = aBytes(String(texto));
  const version = elegirVersion(bytes, nivel, maxVersion);
  if (!version) throw new Error('El texto es demasiado largo para el QR');

  const codewords = codewordsConCorreccion(bitsDeDatos(bytes, version), version, nivel);
  const lado = version * 4 + 17;

  let mejor = null;
  for (let mascara = 0; mascara < 8; mascara++){
    const m = nuevaMatriz(lado, false);
    const fn = nuevaMatriz(lado, false);
    dibujarPatronesFijos(m, fn, version);
    dibujarFormato(m, fn, nivel, mascara);
    colocarDatos(m, fn, codewords);
    aplicarMascara(m, fn, mascara);
    const p = penalizacion(m);
    if (!mejor || p < mejor.p) mejor = { p, m, mascara };
  }

  return { matriz: mejor.m, lado, version, nivel, mascara: mejor.mascara };
}

/**
 * Dibuja el QR como SVG listo para pegar en el HTML.
 * `tamano` es el ancho final en pixeles; `margen` va en modulos (4 por norma).
 */
export function svg(texto, { tamano = 160, margen = 4, nivel = 'M', color = '#111214', fondo = '#FFFFFF', titulo = 'Código QR' } = {}){
  const { matriz, lado } = generar(texto, { nivel });
  const total = lado + margen * 2;

  // Se unen los modulos oscuros de cada fila en un solo trazo: menos nodos, se ve nitido
  let d = '';
  for (let y = 0; y < lado; y++){
    let x = 0;
    while (x < lado){
      if (!matriz[y][x]){ x++; continue; }
      let ancho = 1;
      while (x + ancho < lado && matriz[y][x + ancho]) ancho++;
      d += 'M' + (x + margen) + ',' + (y + margen) + 'h' + ancho + 'v1h-' + ancho + 'z';
      x += ancho;
    }
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + tamano + '" height="' + tamano +
         '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="' +
         String(titulo).replace(/"/g, '&quot;') + '">' +
         '<rect width="' + total + '" height="' + total + '" fill="' + fondo + '"/>' +
         '<path d="' + d + '" fill="' + color + '"/></svg>';
}

/** Version de texto, util para pruebas en la consola */
export function ascii(texto, opciones){
  const { matriz } = generar(texto, opciones);
  return matriz.map(f => f.map(c => (c ? '##' : '  ')).join('')).join('\n');
}
