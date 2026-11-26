# 03 · Cómo está armado y por qué

---

## La decisión de fondo

El proyecto es de **Lógica de Programación** y **Desarrollo Web**. Si usáramos un
framework, lo que el curso quiere ver —el estado, las condiciones, los ciclos, el
manejo de errores— quedaría escondido detrás de la librería.

Así que: **JavaScript sin librerías**, con módulos nativos del navegador
(`import` / `export`). Eso ya no es "código suelto": es organización real, la
misma que usaría un proyecto profesional pequeño.

Tampoco cambiamos de arquitectura respecto al prototipo: el patrón
**estado → render → eventos** es el mismo. Lo que hicimos fue separarlo en
archivos y agregarle lo que faltaba.

---

## Las tres capas

```
  ┌─────────────────────────────────────────────┐
  │  js/pantallas/      QUÉ SE VE                │   devuelven HTML
  │  inicio · agendar · citas · cuenta            │   no deciden nada
  │  visita · expediente · hojas                  │
  └───────────────────┬─────────────────────────┘
                      │ leen y llaman
  ┌───────────────────▼─────────────────────────┐
  │  js/nucleo/        QUÉ PASA                  │   las reglas
  │  agenda · cuenta · fechas · qr                │   sin una línea de HTML
  │  calendario · automatizacion · almacen        │   se puede probar en Node
  └───────────────────┬─────────────────────────┘
                      │ guarda en
  ┌───────────────────▼─────────────────────────┐
  │  localStorage del navegador                  │   los datos
  └─────────────────────────────────────────────┘
```

**La regla que seguimos:** `js/nucleo/` no contiene HTML y no toca el DOM. Por eso
las 36 pruebas de lógica corren en Node, sin navegador.

---

## El ciclo de vida de un toque

```
  el usuario toca un botón con data-act="elegirHora"
            │
            ▼
  app.js    un solo escuchador para toda la app (delegación de eventos)
            │
            ▼
  acciones.elegirHora('09:00')     →  cambia S.hora
            │
            ▼
  repintar()  →  render()
            │
            ├─ llama a la función de la pantalla actual → devuelve HTML
            ├─ lo mete en #dev de una sola vez
            ├─ restaura el desplazamiento y el foco
            └─ vuelve a dibujar el panel del presentador
```

Un solo escuchador para toda la aplicación. No se agregan ni se quitan
escuchadores al cambiar de pantalla, así que no hay fugas.

**El detalle que hace que funcione:** al repintar se guarda dónde estaba el foco
y el cursor, y se restauran después. Sin eso, escribir en un buscador que filtra
en vivo sería imposible.

---

## Por qué el estado está en un solo objeto

```js
export const S = {
  pantalla: 'inicio',
  historial: [],
  medicoId: 'her',
  fecha: null,
  hora: null,
  ...
};
```

Porque así **la pantalla siempre es una función del estado**. No hay forma de que
dos partes de la interfaz muestren cosas distintas: las dos leen de `S`.

Y porque se puede inspeccionar: el panel del presentador salta a cualquier caso
simplemente poniendo `S` en el valor que corresponde y repintando.

---

## Dónde viven los datos

| Qué | Dónde | Sobrevive a |
|---|---|---|
| Pantalla actual, filtros, formularios a medio llenar | `S`, en memoria | nada: se pierde al recargar |
| Cuentas, citas, perfiles | `localStorage` | recargar y cerrar el navegador |
| Sesión abierta | `localStorage`, clave aparte | igual, hasta cerrar sesión |
| Ajustes de la demo | `localStorage`, clave aparte | igual |
| Recordatorios programados | memoria del flujo en n8n | mientras n8n esté corriendo |

**Lo que esto implica, dicho claro:** no hay servidor. Las citas viven en el
navegador de cada persona. Dos teléfonos **no** comparten agenda. Esa fue una
decisión consciente para este alcance, y está en
[08 · Real, simulado y pendiente](08-alcance.md).

---

## Las tres defensas al reservar

Este es el pedazo del que más se puede hablar en la exposición.

```js
export function reservar({ medicoId, fecha, hora, usuarioId, claveIdem }){
  // --- antes de tocar nada: reglas que no dependen de los datos ---
  if (!doc.agenda.includes(hora))  return { ok:false, codigo:'fuera-de-agenda' };
  if (esFinDeSemana(fecha))        return { ok:false, codigo:'fin-de-semana' };
  if (esPasado(fecha, hora))       return { ok:false, codigo:'en-el-pasado' };

  return transaccion((datos) => {
    // 1 · ¿ya procesamos este mismo intento? (doble clic, reintento de red)
    const ya = datos.citas.find(c => c.claveIdem === claveIdem);
    if (ya) return { abortar:true, ok:true, cita: ya, repetida:true };

    // 2 · ¿alguien tomó el horario mientras el usuario decidía?
    const ocupada = datos.citas.some(c => mismoHueco(c) && estaActiva(c));
    if (ocupada) return { abortar:true, ok:false, codigo:'horario-ocupado' };

    // 3 · ¿este paciente ya tiene demasiadas citas activas?
    if (activas.length >= 3) return { abortar:true, ok:false, codigo:'demasiadas' };

    datos.citas.push(cita);
    return { ok:true, cita };
  });
}
```

`transaccion()` **vuelve a leer** el almacenamiento justo antes de escribir. Por
eso dos pestañas del mismo navegador no pueden tomar el mismo horario: la segunda
ve lo que escribió la primera.

En un servidor, el equivalente sería una transacción de base de datos con una
restricción de unicidad en `(médico, fecha, hora)`. **La lógica es la misma**;
cambia dónde corre. Por eso esta capa se podría mudar casi tal cual.

---

## La zona horaria, en un solo lugar

El problema: si guardamos "25 de noviembre a las 9", ¿nueve de dónde? Y si el
teléfono del docente está en otro país, ¿qué hora ve?

La solución: una cita se guarda como **hora de pared en la clínica**
(`fecha: '2026-11-25', hora: '09:00'`), y de ahí se calcula el instante universal
cuando hace falta.

```js
// fechas.js — el único lugar donde se hace la cuenta
export function aInstante(fecha, hora){
  return new Date(Date.UTC(a, m-1, d, h, min) - ZONA.desfaseMin * 60000);
}
```

El Salvador no cambia de hora en el año, así que el desfase es fijo (−6).
Si algún día hiciera falta otra zona, se cambia en `config.js` y la app, el correo
y el calendario siguen de acuerdo.

**Comprobación:** 09:00 en la clínica = `20261125T150000Z` en el `.ics`. Hay una
prueba que lo verifica.

---

## Cómo se habla con n8n

```
   la app                         n8n                     Gmail
     │                             │                        │
     │  1. guarda la cita          │                        │
     │     (ya está lista)         │                        │
     │                             │                        │
     │  2. POST /mediconnect/reserva                        │
     │────────────────────────────►│                        │
     │                             │ valida                 │
     │                             │ descarta repetidos     │
     │                             │ arma el correto + .ics  │
     │                             │───────────────────────►│
     │                             │◄───────────────────────│
     │  3. { ok: true }            │                        │
     │◄────────────────────────────│                        │
     │  4. la cita muestra                                  │
     │     "Confirmación enviada"                           │
```

**Tres reglas que nos pusimos:**

1. **La cita se guarda primero.** n8n nunca decide si una cita existe.
   Si el correo falla, la cita sigue ahí.
2. **La pantalla dice la verdad.** Cuatro estados visibles: enviado, enviando,
   falló (con botón de reintentar) y no configurado.
3. **n8n no sustituye el control de acceso.** Recibe un aviso ya validado, con
   los datos mínimos para el correo. Nada médico.

Si no hay dirección configurada, la app funciona igual y lo dice. Nunca se queda
esperando.

---

## El generador de QR

Es la parte más algorítmica del proyecto. Está en `js/nucleo/qr.js`, en 420
líneas, y hace lo siguiente:

1. **Texto → bytes**, con una cabecera que dice el modo y cuántos caracteres son.
2. **Corrección de errores Reed-Solomon** sobre el campo finito GF(256) con el
   polinomio `0x11D`. Esto es lo que permite leer un QR rayado o con un logo encima.
3. **Reparto en bloques** e intercalado, según la versión y el nivel de corrección.
4. **Dibujo**: los tres cuadros de las esquinas, los cuadritos de alineación, las
   líneas de sincronía y la información de formato y de versión.
5. **Zigzag**: los bits se acomodan en columnas de dos, de abajo hacia arriba y
   de arriba hacia abajo, saltando lo que ya está ocupado.
6. **Ocho máscaras**: se prueba cada una, se mide cuánto "confunde" el dibujo
   resultante con cuatro reglas de penalización, y se elige la mejor.

**Un error que encontramos y arreglamos probando:** las posiciones de los
cuadritos de alineación quedaban en orden inverso, así que desde la versión 2 se
dibujaban en la esquina equivocada y el código no se podía leer. Lo descubrimos
comparando módulo a módulo contra una librería conocida. Ese es exactamente el
valor de tener una referencia contra la cual comparar.

---

## Los archivos y de qué se ocupa cada uno

| Archivo | Responsabilidad |
|---|---|
| `nucleo/config.js` | zona horaria, reglas del negocio, rutas de n8n. Sin secretos |
| `nucleo/fechas.js` | 20 funciones puras de fecha y hora |
| `nucleo/datos.js` | el catálogo ficticio |
| `nucleo/almacen.js` | leer, escribir, transacciones, códigos únicos |
| `nucleo/cuenta.js` | registro, sesión, perfil, validaciones, hash |
| `nucleo/agenda.js` | disponibilidad, reservas, cambios, cancelación, check-in |
| `nucleo/qr.js` | generador de códigos QR |
| `nucleo/calendario.js` | archivo `.ics` y enlaces de calendario |
| `nucleo/automatizacion.js` | el puente con n8n |
| `nucleo/estado.js` | el objeto `S` y la navegación |
| `nucleo/ui.js` | piezas de interfaz reutilizables |
| `app.js` | render, eventos, teclado, ajuste de la maqueta |
| `presentador.js` | el panel, fuera de la app del paciente |
| `pantallas/*.js` | una pantalla por archivo, cada una con sus vistas y sus acciones |
