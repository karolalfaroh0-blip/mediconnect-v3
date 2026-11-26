# 08 · Qué es real, qué está simulado y qué falta

Esta es la tabla honesta del proyecto. Si hay una sola página que leer antes de
la exposición, es esta.

Criterio que usamos para "real": **funciona, se puede comprobar, y si falla la
app lo dice.** Nada se marca como real si solo muestra un aviso bonito.

---

## Real · funciona y se verificó

| Función | Qué significa exactamente | Cómo se comprobó |
|---|---|---|
| **Cuenta y sesión** | Registro con correo y contraseña; la sesión sobrevive a cerrar el navegador | 7 pruebas automatizadas |
| **Contraseña protegida** | No se guarda: se guarda su huella PBKDF2-SHA256 (120.000 vueltas) con sal única | prueba: la contraseña no aparece en el almacenamiento |
| **Perfil persistente** | Datos, contacto de emergencia y seguros, guardados y editables | en el navegador |
| **Citas persistentes** | Se guardan, sobreviven a recargar y se pueden volver a consultar | 7 pruebas |
| **Disponibilidad real** | Un horario ocupado no se puede elegir ni reservar | prueba: "el mismo horario no se puede reservar dos veces" |
| **Sin doble reserva (mismo navegador)** | Dos pestañas no pueden tomar el mismo horario: se relee antes de escribir | prueba de transacción |
| **Sin duplicados por doble clic** | Clave de idempotencia por intento | prueba: "el doble clic no crea dos citas" |
| **Aislamiento entre cuentas** | Una cuenta no ve, cambia, cancela ni hace check-in de la cita de otra | 5 comprobaciones en una prueba |
| **Reprogramar** | Mueve la cita y **libera** el horario anterior | prueba dedicada |
| **Cancelar** | Libera el horario e invalida el pase QR | prueba dedicada |
| **Check-in con QR** | Solo dentro de la ventana, una sola vez, nunca si está cancelada | probado en el navegador y en pruebas |
| **QR escaneables** | Generador propio, norma ISO/IEC 18004 | 24/24 matrices idénticas a la librería `qrcode`; 24/24 decodificadas con `jsQR` |
| **Archivo .ics** | Calendario válido (RFC 5545), con recordatorio y en UTC | prueba: campos, plegado de líneas a 75 octetos y hora correcta |
| **Enlace a Google Calendar** | Abre el formulario con los datos puestos | prueba del enlace |
| **Zona horaria** | `America/El_Salvador` en un solo lugar; app, correo y calendario coinciden | prueba: 09:00 local = 15:00 UTC |
| **Correo por Gmail** | n8n envía desde tu Gmail personal con OAuth2 | flujos importados en n8n 2.29.9 + 33 pruebas de su lógica |
| **Estado real del envío** | La app muestra enviado / enviando / falló / no configurado, y deja reintentar | visible en cada cita |
| **Recordatorio** | n8n lo programa y lo manda; no se repite ni avisa de citas canceladas | 10 pruebas |
| **Explorar sin registrarse** | Todo el recorrido se puede ver sin cuenta | probado en el navegador |
| **Citas de invitado adoptadas** | Al crear la cuenta, las citas hechas como invitado pasan a tu nombre | prueba dedicada |
| **Teléfonos reales** | Pantalla completa, áreas seguras, el teclado no tapa el botón | probado a 375×812 |
| **Accesibilidad básica** | Foco visible, un solo `h1` por pantalla, `aria-invalid`, anuncios para lectores de pantalla, movimiento reducido | revisado pantalla por pantalla |

---

## Simulado · se ve, pero no es real (y la app lo dice)

Cada uno de estos lleva una etiqueta gris **SIMULADO** en la pantalla.

| Función | Qué hace en realidad | Qué haría falta para que fuera real |
|---|---|---|
| **Pago con tarjeta** | Cambia un estado interno. No hay cobro | una pasarela de pago certificada (PCI DSS) |
| **Validación del seguro** | Compara dos listas del catálogo ficticio | integración con la aseguradora |
| **Horarios "tomados por otros"** | Función determinista que da el mismo resultado siempre | una base de datos compartida |
| **Fila de la sala de espera** | Avanza con temporizadores | un sistema de turnos conectado a recepción |
| **Consulta y diagnóstico** | Texto fijo | que un médico lo escriba |
| **Receta** | Texto fijo | receta electrónica con firma |
| **Resultados de laboratorio** | Cuatro exámenes de ejemplo | integración con el laboratorio |
| **Enviar un resultado al médico** | Solo cambia un estado local | mensajería clínica |
| **"Llamando a la clínica"** | Un aviso | enlace `tel:` real (ya está en el comprobante) |
| **Recordatorio de medicinas** | Un interruptor | notificaciones push |
| **Mapa de farmacias** | Dibujo SVG con posiciones fijas | un mapa de verdad |
| **Foto de perfil** | Botón sin efecto | subida de archivos |

---

## Pendiente · lo que no hay y es la siguiente etapa

| Qué falta | Por qué importa | Qué se haría |
|---|---|---|
| **Servidor y base de datos** | Hoy cada teléfono guarda lo suyo: **dos docentes no comparten agenda** | Postgres con reglas por fila; la lógica de `agenda.js` se muda casi tal cual |
| **Disponibilidad compartida de verdad** | Es la consecuencia directa de lo anterior | una restricción de unicidad `(medico, fecha, hora)` en la base |
| **Validación en el servidor** | Hoy las reglas corren en el navegador; alguien con conocimientos podría saltárselas | las mismas funciones, ejecutadas en el servidor |
| **Verificación del correo** | La bienvenida no comprueba que el correo exista | enlace de verificación antes de activar la cuenta |
| **Recuperar la contraseña** | Si se olvida, se pierde la cuenta | enlace de recuperación por correo |
| **n8n siempre encendido** | Hoy depende de que la computadora esté prendida | n8n Cloud o un servidor pequeño |
| **WhatsApp** | El prototipo anterior lo prometía; **lo quitamos** porque no existía | API de WhatsApp Business (tiene costo) |
| **Expediente de verdad** | Requisitos legales de resguardo y consentimiento | fuera del alcance del curso |
| **Telemedicina** | Estaba en los "próximos pasos" del bosquejo | videollamada integrada |

---

## Lo que quitamos a propósito del prototipo anterior

| Qué decía antes | Por qué se quitó |
|---|---|
| *"Te recordamos un día antes por WhatsApp"* | No había WhatsApp. Ahora dice "por correo" y solo si está configurado |
| *"Agregada a tu calendario"* al tocar el botón | No se agregaba nada. Ahora dice "Descargamos el archivo .ics" |
| *"Enviado"* sin que nada se enviara | Ahora cada envío muestra su estado real |
| Un QR dibujado con cuadritos al azar | Ahora es un QR de verdad, escaneable |
| El paciente "David Martínez" fijo | Ahora cada quien tiene su cuenta |
| Botones del panel accesibles desde la consola | Ahora cada acción comprueba que el panel esté habilitado, y se documenta que esconderlo no bastaría con datos compartidos |

---

## Una nota sobre el panel del presentador

El panel escribe en los datos de la demostración: crea citas de ejemplo para
poder saltar a cualquier caso.

Con `?demo=0` desaparece **y además sus acciones dejan de funcionar**: cada
manejador comprueba primero que el panel esté habilitado. Pero somos conscientes
de que, con datos compartidos en un servidor, eso no alcanzaría: harían falta un
rol de administrador y una comprobación del lado del servidor. Lo dejamos escrito
en el propio panel y en el código, porque nos pareció más honesto que esconderlo.
