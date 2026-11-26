# 09 · Qué se probó y qué falta probar

Dos listas separadas a propósito: **lo que ya se ejecutó** y **lo que hay que
comprobar en tu teléfono y con tu cuenta**, porque depende de credenciales
que solo vos tenés.

---

## A · Pruebas automatizadas · 80 de 80 pasan

```powershell
npm test
```

```
ℹ tests 80    ℹ pass 80    ℹ fail 0
```

### Lógica de la app · 36 pruebas (`pruebas/logica.test.js`)

| Grupo | Qué comprueba |
|---|---|
| **Fechas** (5) | ida y vuelta entre hora local y UTC; el sello del `.ics`; 12 a. m. vs 12 p. m.; los días hábiles saltan el fin de semana; sumar días cruza mes, año y año bisiesto |
| **Cuenta** (7) | rechaza datos incompletos; normaliza el correo; **la contraseña no aparece en el almacenamiento**; dos cuentas con la misma contraseña tienen huellas distintas; no se repite el correo; la contraseña incorrecta no entra; el mensaje de error no revela si el correo existe |
| **Agenda — reservar** (7) | una reserva válida se guarda; el mismo horario no se puede reservar dos veces; **el doble clic no crea dos citas**; el horario deja de aparecer libre; otro médico puede atender a esa hora; cancelar libera el horario; cancelar dos veces no rompe nada |
| **Agenda — reglas** (1) | rechaza fin de semana, pasado, horario fuera de la agenda del médico y médico inexistente |
| **Agenda — tope** (1) | la cuarta cita activa se rechaza con código `demasiadas` |
| **Agenda — aislamiento** (1) | otra cuenta no puede ver, cancelar, reprogramar ni hacer check-in de una cita ajena; como invitado tampoco |
| **Agenda — reprogramar** (1) | mueve la cita, libera el horario anterior, conserva el código, y no deja moverla encima de uno ocupado |
| **Agenda — invitado** (1) | al crear la cuenta, las citas de invitado pasan a su nombre |
| **Agenda — día sin cupos** (1) | el bloqueo del panel rechaza de verdad y propone el siguiente día |
| **Agenda — control** (1) | la fecha sugerida nunca cae en fin de semana |
| **Calendario** (2) | el `.ics` tiene todos los campos, ninguna línea pasa de 75 octetos, los puntos y comas van escapados, una cita cancelada sale como `CANCELLED`, y el enlace de Google lleva la misma hora |
| **QR** (4) | versión y tamaño correctos; **huellas de regresión**; los tres cuadros de las esquinas están donde deben; el SVG tiene la zona tranquila de 4 módulos |
| **Almacén** (2) | la transacción relee antes de escribir; 2.000 códigos sin repetir |

### Flujos de n8n · 44 pruebas (`pruebas/flujos-n8n.test.js`)

Estas pruebas sacan el código de cada nodo "Code" del `.json` y lo ejecutan con
un `$input` y un `$getWorkflowStaticData` imitados, igual que haría n8n.

| Grupo | Qué comprueba |
|---|---|
| **Los archivos** (3) | los cuatro existen, el JSON es válido, no hay conexiones hacia nodos inexistentes, **no hay ningún secreto**, las credenciales van con el id vacío, y están las cinco rutas de webhook con CORS configurado |
| **MC-01 registro** (5) | la prueba de conexión no manda correo; rechaza correos inválidos; arma la bienvenida; el mismo evento dos veces no manda dos correos; **escapa el HTML** si alguien pone `<script>` en su nombre |
| **MC-02 reserva** (6) | el correo lleva médico, fecha, hora, lugar, consultorio, código, zona horaria y enlace al comprobante; **adjunta el `.ics`**; no manda confirmación de una cita cancelada; rechaza citas sin fecha; el control se nombra como control; el reintento no duplica |
| **MC-03 cambio/cancelación** (4) | el cambio muestra la fecha vieja y la nueva y adjunta el `.ics` actualizado; la cancelación avisa que el código ya no sirve y **no** lleva adjunto; no deja avisar un cambio de una cita cancelada ni una cancelación de una cita agendada |
| **MC-04 recordatorio** (10) | tiene disparador de tiempo; programa; no envía antes de hora; envía al llegar la hora; **nunca se repite**; reprogramar reemplaza en vez de acumular; cancelar lo borra; una cita cancelada nunca se recuerda; rechaza tiempos absurdos; sin correo válido no guarda nada |
| **Registro de envíos** (1) | distingue "enviado" de "error" y guarda el detalle |

---

## B · Verificación del generador de QR

Hecha aparte, contra herramientas externas:

| Prueba | Resultado |
|---|---|
| Comparación módulo a módulo contra la librería `qrcode` | **24/24 matrices idénticas**, incluida la máscara elegida |
| Decodificación con `jsQR` (un lector de verdad) | **24/24 devuelven exactamente el texto original** |
| Casos cubiertos | 6 textos × 4 niveles de corrección (L, M, Q, H), versiones 1 a 15, con tildes y con direcciones largas de GitHub Pages |

**Un error real que encontró esta comparación:** las posiciones de los cuadritos
de alineación quedaban en orden inverso, así que desde la versión 2 se dibujaban
en la esquina equivocada y el código no se podía leer. Sin la referencia externa
no lo habríamos visto, porque "se veía como un QR".

Las huellas de esas matrices quedaron guardadas como prueba de regresión: si
alguien rompe el generador, la prueba falla.

---

## C · Verificación en el navegador

Hecha con el navegador real, en `http://localhost:5500`.

| Qué se probó | Resultado |
|---|---|
| Entrar sin registrarse y recorrer la app | ✔ se puede llegar hasta la pantalla de confirmación |
| Crear cuenta desde la hoja "¿Cómo guardamos tu cita?" | ✔ vuelve a la confirmación con el seguro ya aplicado |
| Reservar con doble clic | ✔ **una sola cita** (`citas: 1`) |
| La cita sobrevive a recargar | ✔ |
| El QR se dibuja y apunta al comprobante | ✔ `comprobante.html?cita=MC-…` |
| `comprobante.html` con un código válido | ✔ muestra la cita, el QR y los botones de calendario |
| `comprobante.html` con un código de otro teléfono | ✔ explica por qué no aparece, sin dar datos |
| Check-in dentro de la ventana | ✔ pasa a la sala de espera |
| Check-in dos veces | ✔ `usado · Este pase ya se usó a las 09:31 p. m.` |
| Check-in de una cita cancelada | ✔ `cancelada · el pase ya no sirve` |
| Check-in con otra cuenta | ✔ `ajena · Ese pase es de otra cuenta` |
| Reprogramar | ✔ mismo código, `cambios: 1`, horario anterior liberado |
| Cancelar | ✔ estado `cancelada`, pantalla de confirmación |
| Los ocho casos del panel (10 saltos) | ✔ los diez funcionan, **sin un solo error en la consola** |
| Caso C1 | ✔ "No quedan horarios el miércoles 25" + botón "Ir al Jue 26 nov, 2:00 p. m." |
| Validaciones del perfil | ✔ 3 campos marcados, 3 mensajes, `aria-invalid="true"` |
| Un solo `<h1>` por pantalla | ✔ corregido en reprogramar y en el control |
| Modo teléfono (375×812) | ✔ pantalla completa, sin marco ni panel |
| Horizontal (844×390) | ✔ el contenido se adapta y la navegación no estorba |
| Escritorio ancho (1320×860) | ✔ teléfono y panel lado a lado |
| `?demo=0` | ✔ el panel desaparece **y sus acciones dejan de responder** |

---

## D · Verificación de n8n

| Qué | Resultado |
|---|---|
| Los cuatro flujos importan en n8n **2.29.9** | ✔ `Successfully imported 4 workflows` |
| El JavaScript de los 9 nodos "Code" compila | ✔ |
| No hay secretos ni credenciales con id | ✔ |
| La lógica de los nodos | ✔ 33 pruebas |

La prueba se hizo en una **instancia aislada**, con su propia carpeta de datos y
en otro puerto, sin tocar ninguna instancia existente ni nada de la Fundación.
Se detuvo y se descartó al terminar.

---

## D2 · Verificación en n8n Cloud · 26 de noviembre de 2026

En `https://karolalfaro.app.n8n.cloud` (cuenta personal), con Gmail personal conectado.

| Qué | Resultado |
|---|---|
| Los 4 flujos importados, con la credencial asignada y **activos** | ✔ |
| Prueba de conexión (`/registro` con `prueba: true`) | ✔ `200 · Conexión correcta con MediConnect`, CORS `*` |
| Reserva real (MC-02) con `.ics` adjunto | ✔ `200 · Correo enviado` |
| Recordatorio (MC-04 cloud) a 1 minuto | ✘ en la primera versión → corregido (ver abajo) → ✔ enviado al minuto exacto, Gmail lo marca `SENT` |

**Dos errores reales que solo aparecieron en n8n de verdad:**

1. **Los datos venían dentro de `.body`.** El nodo Webhook de n8n entrega
   `{ headers, params, query, body }`, y el código leía el evento directo. Las
   pruebas no lo veían porque le pasaban el evento sin envolver. Ahora el código
   acepta los dos formatos y hay una prueba con el evento envuelto.
2. **Una ejecución dormida no guarda la memoria.** La primera versión del
   recordatorio programaba y se dormía en la misma ejecución; al despertar, la
   consulta respondió "ya no hay recordatorio para esa cita". n8n guarda la
   memoria del flujo solo al **terminar**. Ahora el que programa termina enseguida
   y le encarga la espera a otra ejecución. Hay una prueba que lo exige.

---

## E · Pendiente · hay que probarlo vos

Esto **no se pudo verificar** porque depende de tu cuenta de Google, tu n8n y tus
teléfonos. Está listado aquí para que no se dé por hecho.

| Qué falta comprobar | Cómo se comprueba | Guía |
|---|---|---|
| **Que llegue el correo de bienvenida** | creá una cuenta con tu propio correo | [04](04-guia-n8n-gmail.md) |
| **Que llegue la confirmación con el `.ics` adjunto** | agendá una cita | [04 · parte 5](04-guia-n8n-gmail.md) |
| **Que el `.ics` muestre la hora correcta** | abrí el adjunto; tiene que decir la misma hora que la app | — |
| **Que llegue el aviso de cambio y el de cancelación** | cambiá y cancelá una cita | — |
| **Que el recordatorio llegue una sola vez** | poné 1 minuto en Ajustes y tocá "Probar recordatorio" | — |
| **Que el QR público abra la app** | escanealo con tu teléfono | [05](05-publicar.md) |
| **Que el QR de la cita abra el comprobante** | escanealo con tu teléfono | — |
| **El teclado en un teléfono real** | abrí "Editar mis datos" y tocá un campo: el botón "Guardar" tiene que subir | — |
| **El sitio publicado en GitHub Pages** | abrí la dirección desde un teléfono que no sea el tuyo | [05](05-publicar.md) |
| **Lectores de pantalla** | probar con VoiceOver o TalkBack | — |

---

## Cómo repetir todo

```powershell
npm test
```

```powershell
node herramientas/servidor.js
```

Después, en el navegador: Panel del presentador → recorré los ocho casos y mirá
que el contador llegue a 8 de 8.
