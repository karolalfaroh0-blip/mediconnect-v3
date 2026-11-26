# 01 · Diagnóstico del prototipo anterior

Revisión completa de `prototipo-original.html` (982 líneas, 178 KB, un solo
archivo). Se conserva sin tocar en la raíz del proyecto, para poder comparar.

---

## Qué era

Un prototipo de una sola página con un mini-framework propio, bien hecho:

- un objeto `S` con todo el estado;
- 16 pantallas en un objeto `V`, cada una una función que devuelve HTML;
- 9 hojas modales en un objeto `SH`;
- un `render()` que repinta el teléfono entero;
- un solo escuchador de clics con delegación por `data-act`.

Esa arquitectura es la base de la versión nueva. No se tiró nada.

---

## Qué funcionaba bien

| | |
|---|---|
| **Navegación e historial** | pila de pantallas con animación de ida y de vuelta |
| **Búsqueda de médicos** | texto + chips de especialidad + filtro "solo los que cubre mi seguro" |
| **Fechas vivas** | las fechas se calculaban desde hoy, y `?hoy=` permitía moverlas |
| **Calendario del control** | con días llenos, horarios libres y una fecha sugerida |
| **Validaciones del perfil** | teléfono de 8 dígitos, formato de correo |
| **Panel del presentador** | 8 casos con progreso, controles de simulación y una bitácora |
| **Teléfonos reales** | `body.native` con pantalla completa y áreas seguras |
| **Accesibilidad inicial** | foco visible y respeto por `prefers-reduced-motion` |

---

## Qué estaba simulado (y no se distinguía)

**Todo.** Y ese era el problema principal: no había forma de saber qué era real.

- No había cuenta ni sesión. El paciente era siempre `David Martínez`, escrito
  en el código.
- **Nada persistía.** Al recargar la página se perdía la cita.
- La disponibilidad era una fórmula, no un dato:

  ```js
  const slotFree = (day, i) => isFull(day) ? false : (slots[i][1] && !(day===0 && i<3));
  ```

  Dos personas podían "reservar" el mismo horario sin que nada lo impidiera.
- El código QR era ruido:

  ```js
  function qrSvg(){ let seed=7; const rnd=()=>{ seed=(seed*9301+49297)%233280; ... }
  ```

  Cuadrados al azar con forma de QR. No se podía escanear.
- "Agregar al calendario" solo mostraba un aviso: `data-v="Agregada a tu calendario"`.
- No había correo, ni backend, ni n8n.

---

## Qué fallaba o confundía

**1. Prometía cosas que no existían.**
La pantalla de confirmación decía *"Te recordamos un día antes por WhatsApp"*, y
el menú lo repetía dos veces. No había ninguna integración con WhatsApp.

**2. El panel del presentador se escondía con CSS, no se protegía.**

```css
body.nopanel .panel { display:none!important }
```

Los botones seguían en el DOM. Con datos solo locales no tenía consecuencias,
pero en cuanto hubiera datos compartidos sí.

**3. La lista de casos confundía.**
Había cuatro entradas distintas etiquetadas `C4` y el contador decía "de 8".

**4. El teclado tapaba el botón principal.**
`.action` estaba fija con `bottom:32px`. En pantallas cortas, con el teclado
abierto, el botón quedaba debajo.

**5. El lector de pantalla perdía el hilo.**
Cada render reemplazaba el `<main>` entero. Solo había una región `aria-live`
para los avisos; no se anunciaba el cambio de pantalla ni había `<h1>`.

**6. Contrastes justos.**
`--ink2:#6B6F78` sobre blanco da 4.9:1, y la clase `.dim` con `opacity:.62`
sobre fondos azules y negros quedaba por debajo de lo recomendable.

---

## Qué conservamos

- La paleta: azul `#3B5BF6`, fondos claros, superficies oscuras.
- El radio de 28 px de las tarjetas y 22 px de los mosaicos.
- La tipografía del sistema y su jerarquía (`hero`, `title`, `ct`, `body`, `cap`).
- El tono salvadoreño: "Elegí", "Contanos", "¿Cómo te sentís?".
- La navegación flotante oscura.
- El marco de teléfono para la presentación en escritorio.
- El panel del presentador y sus 8 casos.
- Las ramas académicas: sala → consulta → laboratorio → resumen → control.
- Los avatares ilustrados y las fotos incrustadas (se extrajeron tal cual a
  `js/nucleo/fotos.js`).

---

## Las cinco mejoras que más aportan

Ordenadas por lo que suman a la experiencia y a la exposición:

1. **Que las citas existan de verdad**: cuenta, persistencia y una agenda que
   rechaza horarios ocupados. Sin esto, el resto es decorado.
2. **Decir la verdad en pantalla**: estado real del correo, etiquetas de
   "simulado", y quitar la promesa de WhatsApp.
3. **QR y `.ics` reales**: son las dos cosas que un docente puede comprobar con
   su propio teléfono en cinco segundos.
4. **Errores que proponen una salida**: "no quedan horarios" + el siguiente
   horario libre, en vez de un callejón sin salida.
5. **Que la lógica se vea**: la bitácora del panel escribe las decisiones
   mientras se usa la app. Es el puente entre la demostración y la nota.
