/* ============================================================
   MediConnect · pruebas/entorno.js
   El navegador le da a la app dos cosas que Node no tiene:
   `localStorage` y `location`. Aqui se imitan con lo minimo
   necesario para poder probar la logica fuera del navegador.
   ============================================================ */

class AlmacenFalso {
  constructor(){ this.mapa = new Map(); }
  getItem(k){ return this.mapa.has(k) ? this.mapa.get(k) : null; }
  setItem(k, v){ this.mapa.set(k, String(v)); }
  removeItem(k){ this.mapa.delete(k); }
  clear(){ this.mapa.clear(); }
  get length(){ return this.mapa.size; }
  key(i){ return [...this.mapa.keys()][i] ?? null; }
}

/** Prepara el entorno. `busqueda` imita la parte ?... de la direccion. */
export function prepararEntorno(busqueda = ''){
  globalThis.localStorage = new AlmacenFalso();
  globalThis.location = {
    href: 'http://localhost:5500/' + busqueda,
    origin: 'http://localhost:5500',
    pathname: '/',
    search: busqueda
  };
  return globalThis.localStorage;
}

/** Vacia los datos entre pruebas sin recargar los modulos */
export function limpiarDatos(){
  globalThis.localStorage.clear();
}
