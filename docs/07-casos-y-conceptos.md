# 07 · Los ocho casos y los conceptos que demuestran

Los ocho casos vienen del bosquejo original del proyecto. Se conservan tal cual,
y cada uno se eligió porque obliga a resolver algo distinto.

Esta tabla es la respuesta corta a "¿dónde está lo que aprendimos?".

---

## Resumen

| Caso | Qué pasa en pantalla | Qué concepto resuelve | Dónde está el código |
|---|---|---|---|
| **C1** | El día elegido ya no tiene cupos | Condicionales, ciclos, búsqueda | `agenda.js` → `horariosDe`, `proximoDiaLibre` |
| **C2** | Check-in con QR, cambiar o cancelar | Máquina de estados, validaciones, control de acceso | `agenda.js` → `checkIn`, `reprogramar`, `cancelar` |
| **C3** | El seguro cubre: $0 | Condicional compuesta, estructuras de datos | `agendar.js` → `evaluarSeguro` |
| **C4** | Seguro vencido, no aceptado o pago rechazado | Ramas de error, estado consistente | `agendar.js` → `vistas.pago`, `acciones.pagar` |
| **C5** | La consulta y la fila de espera | Temporizadores, eventos, actualización de interfaz | `visita.js` → `programarAvances` |
| **C6** | El médico ordena un examen | Bifurcación según una decisión externa | `visita.js` → `decidirConsulta` |
| **C7** | Cierre: diagnóstico, receta, pago | Agregación de datos, transición final | `visita.js` → `vistas.resumen` |
| **C8** | Se agenda el control: el ciclo reinicia | Aritmética de fechas, recursión del flujo | `agenda.js` → `fechaControl` |

---

## C1 · Agendar cuando no hay cupos

**Qué ve el paciente:** elige el miércoles y todos los horarios aparecen tachados.
La app le dice cuál es el siguiente horario libre y lo lleva ahí de un toque.

**Lo que resuelve:**

- **Ciclos**: recorrer los horarios del día y clasificar cada uno.
- **Condicionales encadenadas**: un horario puede estar fuera de la agenda del
  médico, en el pasado, ocupado por otro, o ser tuyo. Son cinco estados, no dos.
- **Búsqueda**: `proximoDiaLibre` avanza día a día saltando fines de semana hasta
  encontrar uno con hueco, con un tope para no quedarse en bucle infinito.

```js
// agenda.js
export function horariosDe(medicoId, fecha, usuarioId){
  return HORARIOS.map(hora => {
    if (!doc.agenda.includes(hora))            return { hora, estado:'fuera' };
    if (mia)                                   return { hora, estado:'mia' };
    if (esPasado(fecha, hora))                 return { hora, estado:'pasado' };
    if (delDia.some(c => c.hora === hora))     return { hora, estado:'ocupado' };
    if (tomadoPorOtro(medicoId, fecha, hora))  return { hora, estado:'ocupado' };
    return { hora, estado:'libre' };
  });
}
```

**Lo interesante:** la interfaz no sabe nada de reglas. Solo pinta según el estado
que le devuelve la agenda. Si mañana cambia una regla, la pantalla no se toca.

---

## C2 · Check-in, cambio y cancelación

**Qué ve el paciente:** escanea su QR y entra a la sala. O cambia la fecha. O
cancela y el horario queda libre.

**Lo que resuelve:**

- **Máquina de estados**: una cita solo puede moverse por caminos válidos.

```
  agendada ──check-in──► en_sala ──► en_consulta ──► atendida
     │
     ├──reprogramar──► agendada (otra fecha, mismo código)
     └──cancelar────► cancelada  (fin: no hay vuelta)
```

- **Validaciones con una razón**: cada rechazo devuelve un código y un mensaje.

| Situación | Código | Lo que se le dice al paciente |
|---|---|---|
| El pase ya se usó | `usado` | "Este pase ya se usó a las 9:31 a. m." |
| La cita está cancelada | `cancelada` | "Esa cita está cancelada: el pase ya no sirve" |
| Todavía es temprano | `temprano` | "El pase se activa 2 horas antes de tu cita" |
| Es de otra cuenta | `ajena` | "Ese pase es de otra cuenta" |
| Faltan menos de 4 horas | `tarde` | "Llamá a la clínica al 2200-1000" |

- **Control de acceso**: todas las operaciones piden `usuarioId` y comparan.
  Una cuenta no puede ver, cambiar ni cancelar la cita de otra.

---

## C3 · El seguro cubre: $0

**Qué ve el paciente:** "Tu seguro SISA · Cubierto · Pagás hoy $0.00".

**Lo que resuelve:**

- **Condicional compuesta**: hacen falta **dos** cosas a la vez.

```js
if (!candidato.vigente)              return { estado: 'vencido' };
if (!doc.nets.includes(candidato.id)) return { estado: 'noacepta' };
return { estado: 'cubre' };
```

- **Estructuras de datos**: cada médico tiene una lista `nets` con las
  aseguradoras que acepta, y cada paciente una lista de pólizas. El cruce de
  esas dos listas es la respuesta.
- **Devolver un estado, no un booleano**: `cubre | vencido | noacepta | sin`.
  Cuatro estados permiten cuatro mensajes distintos; un `true/false` solo
  permitiría decir "no se puede", que no ayuda a nadie.

---

## C4 · Cuando el dinero falla

Tres escenarios distintos que la gente suele meter en el mismo saco:

| Sub-caso | Qué pasa | Qué cambia en la pantalla |
|---|---|---|
| **C4a** | La póliza está vencida | "No pudimos validar tu seguro" + opciones de pago |
| **C4b** | El médico no acepta ese seguro | Se listan los seguros que **sí** acepta |
| **C4c** | El banco rechaza la tarjeta | Reintentar, otra tarjeta o pagar en caja |

**Lo que resuelve:**

- **Manejo de errores con estado consistente.** La regla que seguimos:
  **la cita se guarda al final, no al principio.** Si el pago falla, no hay nada
  a medias que limpiar. Por eso los tres mensajes pueden decir con honestidad
  *"no se hizo ningún cobro y tu horario sigue apartado"*.
- **Mensajes que proponen una salida**, no que solo informan del problema.

---

## C5 · La consulta

**Qué ve el paciente:** su número, cuántos faltan, y la fila avanzando sola.

**Lo que resuelve:**

- **Temporizadores y asincronía**: `setTimeout` encadenados que avanzan la fila,
  todos registrados para poder cancelarlos al cambiar de pantalla. Sin eso,
  un temporizador viejo repintaría una pantalla que ya no existe.
- **Eventos y actualización de interfaz**: no se toca el DOM a mano. Se cambia
  el estado y se vuelve a dibujar.

```js
export function programarAvances(){
  if (hayTemporizadores()) return;          // no se acumulan
  if (S.pantalla === 'sala' && S.turno > 0){
    programar(() => { S.turno--; repintar(); programarAvances(); }, 3000);
  }
}
```

---

## C6 · Requiere laboratorio

**Qué ve el paciente:** el médico ordena un hemograma; la orden ya está en el
laboratorio y el resultado llega al expediente.

**Lo que resuelve:**

- **Bifurcación según una decisión que no controla el usuario.** En la vida real
  decide el médico. En la demostración decide el panel del presentador, que está
  **fuera** de la app del paciente: esa separación es a propósito.
- **Proceso por pasos**: orden → muestra → resultado, cada uno con su estado.

---

## C7 · Cierre y expediente

**Qué ve el paciente:** diagnóstico, receta enviada a la farmacia, laboratorio,
pago y una calificación.

**Lo que resuelve:**

- **Agregación**: la pantalla junta datos que vienen de cuatro lugares distintos
  (la cita, el seguro, el laboratorio y la consulta) en una sola vista.
- **Transición final de estado**: `atendida` es un estado terminal; desde ahí la
  cita ya no se puede cambiar ni cancelar.

---

## C8 · La cita de seguimiento

**Qué ve el paciente:** "Volvé el miércoles 2 de diciembre", con el calendario
ya abierto en esa fecha.

**Lo que resuelve:**

- **Aritmética de fechas**: siete días después, y si cae sábado o domingo, se
  corre al lunes.

```js
export const fechaControl = (cita) => {
  let f = sumarDias(cita.fecha, 7);
  while (esFinDeSemana(f)) f = sumarDias(f, 1);
  return f;
};
```

- **El ciclo se cierra**: agendar el control usa **exactamente las mismas
  funciones** que agendar la primera cita. No hay un camino especial. Eso es
  reutilización, y es lo que hace que el caso 8 vuelva al caso 1.

---

## Conceptos del curso y dónde verlos

| Concepto | Dónde se ve mejor |
|---|---|
| **Variables y constantes** | `datos.js` (el catálogo), `config.js` (las reglas en un solo lugar) |
| **Estructuras de datos** | listas de médicos y pólizas; `Set` para los síntomas; objeto `cita` |
| **Condicionales** | `evaluarSeguro` (cuatro estados), `horariosDe` (cinco estados) |
| **Ciclos** | `horariosDe`, `diasHabiles`, el zigzag del generador de QR |
| **Funciones** | todo; `fechas.js` son 20 funciones puras, cada una con una sola tarea |
| **Funciones puras vs. con efecto** | `fechas.js` no toca nada; `agenda.js` sí escribe |
| **Validaciones** | `cuenta.js → reglas`, y las tres defensas de `reservar()` |
| **Estados y transiciones** | la máquina de estados de la cita (C2) |
| **Eventos** | un solo escuchador en `app.js` para toda la app (delegación) |
| **Actualización de la interfaz** | `render()`: el estado manda, la pantalla obedece |
| **Persistencia** | `almacen.js`: leer, escribir y transacciones |
| **Concurrencia** | relectura antes de escribir + clave de idempotencia |
| **Manejo de errores** | códigos de error con mensaje, estados de carga y reintentos |
| **Integraciones** | `automatizacion.js` ↔ n8n ↔ Gmail |
| **Algoritmos** | el generador de QR: Reed-Solomon sobre GF(256), 8 máscaras y su penalización |
| **Pruebas** | 69 pruebas automatizadas en `pruebas/` |

---

## Tres detalles para contar si hay tiempo

**1. La clave de idempotencia.**
Si tocás "Confirmar" dos veces rápido, no se crean dos citas. Cada intento lleva
una clave única; si llega una clave repetida, se devuelve la cita que ya existía.
Es lo mismo que hacen los sistemas de pago para no cobrarte dos veces.

**2. La zona horaria en un solo lugar.**
Una cita se guarda como "25 de noviembre a las 09:00 **en la clínica**". De ahí se
calcula el instante universal que necesitan el correo y el calendario. Así, aunque
el teléfono del docente esté configurado en otro país, la hora que ve es la correcta.

**3. El generador de QR.**
Está escrito a mano: convierte el texto a bytes, calcula la corrección de errores
con polinomios sobre un campo finito, acomoda los bits en zigzag y prueba ocho
máscaras para elegir la que menos confunde a la cámara. Son 420 líneas y es el
pedazo de algoritmo más denso del proyecto.
