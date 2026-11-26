# 02 · Qué cambió

De un archivo de 982 líneas a un proyecto de 27 archivos, conservando la
identidad visual y la arquitectura de estado del original.

---

## Lo nuevo que antes no existía

### Cuenta, perfil y sesión
- Registro con nombre, correo y contraseña; inicio de sesión; cierre de sesión.
- La contraseña no se guarda: se guarda su huella PBKDF2-SHA256 con 120.000
  vueltas y una sal única por persona.
- El perfil reemplaza al "David Martínez" fijo: datos, contacto de emergencia y
  seguros, todo editable y guardado.
- **Se puede recorrer toda la app sin cuenta.** La cuenta aparece en el momento
  de guardar una cita, con la opción de seguir como invitado.
- Las citas hechas como invitado pasan a la cuenta cuando se crea.

### Citas de verdad
- Se guardan en el navegador y sobreviven a recargar y a cerrar.
- Nueva pestaña **Citas**: las próximas y las anteriores, con su estado.
- Cada cita tiene código (`MC-XXXXXX`), estado, historial de cambios y estado
  de notificación.

### Agenda con reglas
- La disponibilidad se calcula contra las citas guardadas, no con una fórmula.
- Cinco estados por horario: libre, ocupado, mía, pasado, fuera de agenda.
- Cada médico tiene su propia agenda: no todos atienden a las mismas horas.
- Tres defensas al reservar: clave de idempotencia, relectura antes de escribir
  y reglas de negocio (fin de semana, pasado, anticipación, tope de citas).
- Reprogramar libera el horario anterior; cancelar libera el horario e invalida
  el pase.

### Códigos QR reales
- Generador propio, norma ISO/IEC 18004, modo byte, versiones 1 a 20.
- Verificado dos veces: 24/24 matrices idénticas a la librería `qrcode`, y
  24/24 decodificadas correctamente con `jsQR`.
- **QR de cita**: abre `comprobante.html?cita=CÓDIGO`, una página que muestra la
  cita, permite el check-in y descarga el calendario.
- **QR público**: `node herramientas/generar-qr.js URL` genera el SVG y una hoja
  lista para imprimir.

### Calendario
- Archivo `.ics` válido (RFC 5545): plegado de líneas a 75 octetos, escapes
  correctos, `VALARM` una hora antes, `STATUS:CANCELLED` si la cita se canceló.
- Enlaces a Google Calendar y a Outlook con los datos puestos.
- El botón dice "Descargar" y el aviso dice qué pasó de verdad: **nunca dice
  "agregada"**.

### Automatizaciones con n8n
- Cuatro flujos exportables, sin credenciales: registro, reserva, cambio y
  cancelación, y recordatorio.
- Validación, idempotencia y plantilla de correo con la identidad de MediConnect.
- El recordatorio usa un disparador de tiempo, no se repite y descarta las citas
  canceladas.
- Se configuran desde la app (Perfil → Ajustes de la demo) o con `?n8n=…`.
- **La cita se guarda primero y se avisa después.** Si el correo falla, la cita
  sigue ahí y la pantalla lo dice.

### Pantalla de ajustes
- Dirección del webhook con validación y botón de "Probar conexión".
- Minutos del recordatorio (1, 3, 5, 10, 60 o un día) para poder mostrarlo en vivo.
- Cuántas cuentas y citas hay guardadas, y un botón para borrar todo.

### Pruebas
- 69 pruebas automatizadas: 36 de la lógica de la app y 33 de los flujos de n8n.

---

## Lo que mejoró de lo que ya había

### Diseño
- Contraste corregido: `--ink2` de `#6B6F78` a `#5B6069`, `--ok` y `--warn`
  oscurecidos, `.dim` de `.62` a `.72`.
- Campo de formulario con etiqueta, texto de ayuda, estado de error y
  `aria-invalid`; el campo enfocado se ilumina.
- Estados que faltaban: esqueletos de carga, pantallas vacías con una salida,
  cajas de error con reintento, botones con hilandero.
- Etiqueta gris **SIMULADO** donde el prototipo finge.
- Microinteracciones útiles: el botón principal dice qué va a pasar
  ("Continuar · Lun 23 nov, 9:00 a. m."), el día lleno se ve apagado, el
  horario propio se marca en verde.

### Accesibilidad
- Un solo `<h1>` por pantalla, y se anuncia el cambio de pantalla.
- Enlace "Saltar al contenido" para quien navega con teclado.
- `aria-pressed` en los selectores, `role="radiogroup"` en las formas de pago,
  `role="switch"` en los interruptores, `aria-modal` en las hojas.
- `Escape` cierra la hoja abierta; `Enter` envía los formularios.
- Soporte de `prefers-contrast: more`.

### Teléfonos reales
- El teclado ya no tapa el botón: se mide con `visualViewport` y se ajusta una
  variable CSS `--teclado`.
- Modo teléfono también en tabletas con pantalla táctil.
- Ajustes para pantalla horizontal con poca altura.

### Textos
- Fuera la promesa de WhatsApp: ahora dice correo, y solo si está configurado.
- Cada error dice qué pasó, qué **no** pasó ("no se hizo ningún cobro") y qué
  se puede hacer.
- Las hojas de ayuda y privacidad explican dónde se guardan los datos.

### Panel del presentador
- Los sub-casos se nombran C4a, C4b y C4c: ya no hay cuatro cosas llamadas "C4".
- Los saltos crean citas de ejemplo de verdad, en vez de fingir estado.
- La bitácora distingue aciertos de errores con color.
- Cada acción comprueba que el panel esté habilitado antes de escribir.
- Bloque de automatización con el estado de la conexión y un botón para probar
  el recordatorio en vivo.

---

## Lo que se conservó tal cual

La paleta, los radios, la tipografía, el tono, la navegación flotante, el marco
de teléfono, los ocho casos, las ramas de sala/consulta/laboratorio/resumen/control,
los avatares ilustrados, las fotos incrustadas y el patrón de estado + render +
delegación de eventos.

---

## De un archivo a veintisiete

| Antes | Ahora |
|---|---|
| 1 archivo, 982 líneas | 27 archivos |
| CSS, HTML y JS mezclados | `css/`, `js/nucleo/`, `js/pantallas/` |
| Lógica y pantalla juntas | el núcleo no sabe nada de HTML |
| Sin pruebas | 69 pruebas |
| Sin documentación | 9 documentos |

El original sigue en `prototipo-original.html`, intacto.
