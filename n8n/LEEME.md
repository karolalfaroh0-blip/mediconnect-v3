# Flujos de n8n

> **¿Usás n8n Cloud?** Importá los de la carpeta `cloud/`: MC-04 cambia para no
> gastar el cupo de ejecuciones. Ver [docs/10 · n8n Cloud](../docs/10-n8n-cloud.md).

Cuatro flujos exportables, **sin credenciales**. Al importarlos, el nodo de Gmail
va a aparecer sin credencial: eso es a propósito y se arregla en
[docs/04 · Conectar tu n8n y tu Gmail](../docs/04-guia-n8n-gmail.md).

| Archivo | Flujo | Entrada |
|---|---|---|
| `MC-01-registro.json` | bienvenida al crear la cuenta | `POST /webhook/mediconnect/registro` |
| `MC-02-reserva.json` | confirmación con `.ics` adjunto | `POST /webhook/mediconnect/reserva` |
| `MC-03-cambio-cancelacion.json` | aviso de cambio o cancelación | `POST /webhook/mediconnect/cambio` y `/cancelacion` |
| `MC-04-recordatorio.json` | recordatorio antes de la cita | `POST /webhook/mediconnect/recordatorio` + disparador cada minuto |

---

## Cómo se editan

**No edites los `.json` a mano.** El código de los nodos "Code" vive en
`construir.js`, que es donde se lee cómodamente. Después:

```powershell
node n8n/construir.js   # escribe n8n/*.json y n8n/cloud/*.json
```

Y se vuelven a importar en n8n.

Para comprobar que la lógica sigue bien, sin levantar n8n:

```powershell
node --test pruebas/flujos-n8n.test.js
```

Esas 44 pruebas sacan el código de cada nodo del `.json` y lo ejecutan con un
`$input` y un `$getWorkflowStaticData` de mentira. Comprueban las validaciones,
la idempotencia, el armado del correo y el programador del recordatorio.
Lo único que no cubren es el envío real por Gmail.

---

## Lo que tienen en común los cuatro

**Validan antes de enviar.** Cada flujo comprueba que el evento sea el que
espera, que el correo tenga forma de correo y que el estado de la cita
concuerde con el aviso. Nunca se manda un "cita confirmada" de una cita
cancelada.

**No repiten.** Cada evento lleva una clave `idEvento`. El flujo guarda las
claves vistas en las últimas 24 horas; si llega una repetida, responde "ok,
duplicado" sin mandar nada. Así un doble clic o un reintento de red no producen
dos correos.

**Escapan el HTML.** Todo lo que viene de afuera pasa por `escapar()` antes de
entrar en la plantilla del correo. Si alguien pusiera `<script>` en su nombre,
llegaría como texto.

**Responden siempre.** Aunque Gmail falle, el flujo responde a la app con el
error, para que la pantalla diga la verdad. El nodo de Gmail está configurado
con `onError: continueRegularOutput` justamente para eso.

**Dejan registro.** Cada envío se anota en la memoria del flujo: cuándo, a
quién, y si salió bien o mal.

---

## MC-04 merece una nota aparte

Es el único con **dos entradas** que comparten memoria:

```
  POST /webhook/mediconnect/recordatorio ──► Programar o descartar ──► responde
                                                     │
                                            (memoria del flujo)
                                                     │
  Disparador cada minuto ──────────────────► ¿A quién le toca? ──► Gmail
```

- El webhook **guarda** un recordatorio (o lo **quita**, si la cita se canceló).
- El disparador revisa cada minuto cuáles ya toca enviar.
- Marca el envío **antes** de mandar el correo: si Gmail falla, no se queda
  reintentando en bucle.
- Un recordatorio por cita: si se reprograma, se reemplaza, no se acumula.

**Este flujo tiene que quedar ACTIVO en n8n.** Si está inactivo, el disparador de
tiempo no corre y los recordatorios no salen nunca.

Para probarlo en vivo durante la exposición: en la app, Ajustes de la demo →
poné el recordatorio en 1 minuto, y en el panel del presentador tocá
**Probar recordatorio**.

---

## CORS

Los webhooks vienen con *Allowed Origins* en `*` para que funcionen mientras
probás desde `localhost` y desde GitHub Pages.

**Cuando tengas la dirección definitiva**, cambialo en cada nodo Webhook por tu
dominio exacto:

```
https://tu-usuario.github.io
```

---

## Qué datos recibe n8n

Lo mínimo para armar el correo:

```json
{
  "evento": "reserva",
  "idEvento": "ev_...",
  "zona": { "id": "America/El_Salvador" },
  "app":  { "nombre": "MediConnect", "url": "https://..." },
  "paciente": { "nombre": "Karol Alfaro", "correo": "karol@ejemplo.com" },
  "cita": {
    "codigo": "MC-ABC123", "estado": "agendada",
    "fecha": "2026-11-25", "hora": "09:00",
    "fechaTexto": "Miércoles 25 de noviembre", "horaTexto": "9:00 a. m.",
    "medico": { "nombre": "Dr. Luis Herrera", "especialidad": "Cardiología" },
    "lugar":  { "clinica": "...", "direccion": "..." },
    "enlaces": { "comprobante": "https://...", "calendarioGoogle": "https://..." }
  },
  "ics": "BEGIN:VCALENDAR..."
}
```

**No viaja** ningún dato médico, ni contraseñas, ni número de tarjeta, ni
documento de identidad. El `idEvento` es solo para no repetir.
