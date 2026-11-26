# 11 · Auditoría experta · 26 de noviembre de 2026

Revisión de la app publicada (`karolalfaroh0-blip.github.io/mediconnect-v3`),
los flujos de n8n Cloud y el código. Tres frentes: **flujo del paciente**,
**diseño visual** y **solidez técnica**. Cada hallazgo dice qué se hizo.

---

## 1 · Flujo del paciente

| # | Hallazgo | Gravedad | Qué se hizo |
|---|---|---|---|
| F1 | La bienvenida empujaba a **explorar sin cuenta**. El objetivo del proyecto (cita guardada + correo de confirmación) quedaba como paso opcional al final. | Alta | **La cuenta va primero.** El botón principal es *Crear mi cuenta*; *Solo quiero mirar* queda como enlace discreto para la exposición. |
| F2 | Al confirmar sin cuenta se abría una hoja con tres salidas (crear, entrar, seguir como invitado). Era un desvío más y el invitado **no recibía correo**. | Alta | Confirmar sin cuenta lleva **directo al registro** y, al terminar, **vuelve a la misma cita**. El botón dice *Crear cuenta y confirmar*. |
| F3 | En el registro no se veía qué cita quedaba esperando. | Media | Tarjeta *Tu cita te espera* con médico, fecha y hora. |
| F4 | Al confirmar no se decía **a qué correo** llegaría la confirmación. | Media | En *Revisá tu cita* y en la cita confirmada aparece la dirección exacta. |
| F5 | El estado del correo estaba debajo del QR y de los detalles. | Media | Se movió justo debajo de *¡Listo! Tu cita está confirmada*: es lo primero que el paciente quiere saber. |
| F6 | La bienvenida no explicaba el recorrido. | Baja | Tres pasos visibles: *Creá tu cuenta → Elegí médico y hora → Te llega el correo*. |

**Recorrido final:** Bienvenida → Crear cuenta (llega la bienvenida por correo)
→ Elegir médico → Elegir día y hora → Revisar → Confirmar (llega la
confirmación con `.ics` y QR) → recordatorio antes de la cita.

---

## 2 · Diseño visual · liquid glass

Nuevo archivo `css/liquid.css`, cargado al final. **Solo cambia superficies**
(fondo, borde, sombra, desenfoque): no mueve nada, así que la maqueta y las
pruebas siguen iguales.

| Pieza | Antes | Ahora |
|---|---|---|
| Fondo de la app | gris plano `#F2F3F5` | cuatro luces de color (azul, violeta, turquesa, rosa) que se mueven despacio; sin color detrás el vidrio no se nota |
| Tarjetas | blanco sólido | vidrio 58 % con `backdrop-filter: blur + saturate`, filo de luz arriba y sombra en capas teñida de azul |
| Barra de navegación | píldora negra | vidrio claro con **refracción real** (filtro SVG `#vidrio`) en Chrome/Edge; desenfoque normal en Safari/Firefox |
| Botón principal | azul plano | vidrio de marca con degradado, brillo interior y un reflejo que cruza al tocarlo |
| Días, horarios, campos | gris plano | vidrio fino; el elegido es vidrio de marca u oscuro con brillo |
| Hojas, avisos, panel | sólidos | vidrio denso con velo desenfocado detrás |

**Accesibilidad y rendimiento, cuidados a propósito:**

- `prefers-reduced-transparency` → superficies sólidas.
- Navegadores sin `backdrop-filter` → blanco al 94 %.
- `prefers-reduced-motion` → sin luces en movimiento ni reflejos.
- `prefers-contrast: more` → tarjetas casi opacas.
- En teléfonos reales el desenfoque baja de 22 a 16 px para que el
  desplazamiento no se trabe.
- El QR queda sobre blanco al 92 %: con vidrio no se escanearía bien.

---

## 3 · Solidez técnica

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| T1 | El código de n8n leía el evento directo, pero el Webhook lo entrega dentro de `body`. **Ningún correo habría salido.** | Crítica | ✔ Corregido y con prueba |
| T2 | El recordatorio dormía en la misma ejecución que guardaba la memoria; n8n solo guarda al terminar. | Crítica | ✔ Rediseñado en 3 ejecuciones y probado en vivo |
| T3 | El recordatorio original revisaba cada minuto: 1.440 ejecuciones al día, agotaba la prueba de n8n Cloud en horas. | Alta | ✔ Versión cloud con nodo Wait |
| T4 | `node herramientas/servidor.js` y `node n8n/construir.js` fallaban: usaban `require` en un proyecto `"type": "module"`. | Alta | ✔ Corregidos |
| T5 | El servidor local comparaba rutas con `startsWith(RAIZ)`: una carpeta hermana con nombre parecido pasaba el filtro. | Baja | ✔ Ahora exige el separador de carpeta |
| T6 | Cualquiera que lea el código puede llamar a los webhooks y hacer que n8n mande correos a **cualquier dirección** desde tu Gmail. | Alta | ⚠ **Pendiente**, ver abajo |
| T7 | CORS abierto (`*`) en los webhooks. | Media | ⚠ Pendiente: cambiar a `https://karolalfaroh0-blip.github.io` después de la exposición |
| T8 | Las citas viven en el navegador: dos teléfonos no comparten agenda. | Media | Documentado en `08-alcance.md`; es una limitación aceptada del prototipo |
| T9 | La prueba de n8n Cloud vence el 10 de diciembre. | Media | Documentado en `10-n8n-cloud.md` |

### Recomendación para T6 (antes de compartir el enlace en público)

Una app estática no puede guardar secretos, así que la defensa va en n8n:

1. **Tope por destinatario:** no más de 5 correos por dirección cada 24 horas
   (se guarda en la memoria del flujo, igual que `vistos`).
2. **Tope global:** no más de 50 correos al día en total.
3. **CORS cerrado** al dominio de GitHub Pages.

Con eso, el peor abuso posible es acotado y no compromete tu cuenta de Gmail.

---

## 4 · Verificación

| Qué | Resultado |
|---|---|
| Pruebas automatizadas | ✔ 80 de 80 |
| Recorrido nuevo de punta a punta en Chromium (bienvenida → cuenta → médico → hora → confirmar → cita) | ✔ sin errores de consola |
| Invitado que confirma → registro → vuelve a la cita → *Confirmar cita* | ✔ |
| Correos reales desde n8n Cloud (bienvenida, confirmación con `.ics`, recordatorio) | ✔ probados el 26 de noviembre |
| VoiceOver / TalkBack | ✘ no probado: hacerlo antes de la exposición |
