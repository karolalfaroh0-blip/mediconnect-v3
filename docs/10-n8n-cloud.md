# 10 · MediConnect en n8n Cloud

Esta es la forma recomendada para la exposición. Reemplaza las partes 1, 2 y 4
de la [guía 04](04-guia-n8n-gmail.md): no hace falta instalar n8n, ni crear un
proyecto en Google Cloud, ni levantar el túnel de Cloudflare.

**Instancia:** `https://karolalfaro.app.n8n.cloud` — cuenta **personal** de Karol,
en prueba gratis de 14 días. No se usa nada de la Fundación.

---

## Qué ya está hecho

| Paso | Estado |
|---|---|
| Cuenta de n8n Cloud personal | ✔ |
| MC-01, MC-02, MC-03 y MC-04 (versión cloud) importados | ✔ |
| Credencial `Gmail personal MediConnect` creada | ✔ falta *Sign in with Google* |
| La app apunta a `https://karolalfaro.app.n8n.cloud/webhook` | ✔ en `js/nucleo/config.js` |
| Pruebas | ✔ 80 de 80 |

## Qué falta

1. **Conectar Gmail.** En n8n → Credentials → *Gmail personal MediConnect* →
   **Sign in with Google** → elegir el Gmail personal → aceptar → **Save**.
2. **Asignar la credencial** en el nodo de Gmail de cada uno de los 4 flujos.
3. **Publicar (activar)** los 4 flujos. Sin esto, los webhooks de producción
   (`/webhook/...`) no responden.
4. **Probar** como dice la parte 5 de la [guía 04](04-guia-n8n-gmail.md).

---

## Por qué MC-04 es distinto en la nube

n8n Cloud cobra por **ejecuciones**. La prueba gratis trae **1.000**.

El MC-04 original tiene un disparador **cada minuto**: 1.440 ejecuciones por día.
En la nube agotaría la prueba en menos de un día, aunque no hubiera ninguna cita.

La versión cloud (`n8n/cloud/MC-04-recordatorio-cloud.json`) funciona así:

```
POST /mediconnect/recordatorio           (ejecución 1: guarda y TERMINA)
  → Programar o descartar   (guarda la cita y una "ficha" nueva)
  → Responder a la app      (la app recibe el OK enseguida)
  → Encargar la espera      (llama a la ruta de abajo y termina)

POST /mediconnect/recordatorio-esperar   (ejecución 2: duerme)
  → Dormir hasta la hora    (nodo Wait: dormir NO gasta ejecuciones)
  → ¿Sigue vigente?         (le pregunta al propio flujo ↓)
  → Gmail, solo si sigue vigente

POST /mediconnect/recordatorio-vigente   (ejecución 3: decide)
  → Revisar y marcar        (lee la memoria fresca: ¿se canceló? ¿se reprogramó?
                             ¿ya se envió? Si todo bien, marca y arma el correo)
```

**Por qué tres y no una:** n8n guarda la memoria del flujo solo cuando una
ejecución **termina**. Si la misma ejecución que guarda el recordatorio se
quedara dormida, la memoria no se guardaría hasta despertar. Lo comprobamos en
vivo el 26 de noviembre: la primera versión respondió "ya no hay recordatorio
para esa cita" y no envió nada.

- **Reprogramar** cambia la ficha: la ejecución vieja que está dormida despierta,
  pregunta, y se le contesta "ya no vale".
- **Cancelar** borra el recordatorio: la ejecución dormida no encuentra nada.
- **Nunca se repite**: se marca como enviado antes de mandar.
- **Costo:** 3 ejecuciones por recordatorio, 1 por cancelación.

¿Por qué la consulta? Una ejecución dormida trae una copia vieja de la memoria
del flujo. Si escribiera en ella, pisaría lo que pasó mientras dormía. Por eso
todo lo que se anota se anota en la consulta, que siempre lee lo último.

## Cuánto se gasta en la exposición

| Acción | Ejecuciones |
|---|---|
| Crear cuenta (bienvenida) | 1 |
| Agendar (confirmación + programar y encargar el recordatorio) | 3 |
| Recordatorio cuando llega la hora | 1 |
| Reprogramar | 3 |
| Cancelar | 2 |
| Probar la conexión desde Ajustes | 1 |

Un ensayo completo gasta unas **10**. Las pruebas con **Execute workflow** desde
el editor **no cuentan**.

## Después de la prueba gratis

A los 14 días la instancia se apaga si no se paga el plan Starter. Si la
exposición es después, hay dos caminos:

- volver al n8n local con túnel (guía 04, partes 1 a 4) y dejar `base: ''` en
  `js/nucleo/config.js`;
- o pagar un mes del plan Starter.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La app dice "no confirmado" o 404 | el flujo no está publicado (activo) |
| Error de CORS en la consola | el nodo Webhook no tiene *Allowed Origins* en `*` o en tu dominio |
| El correo no llega pero la app dice OK | revisá **Executions** en n8n: el nodo Gmail muestra el error |
| "Execution limit reached" | se acabaron las 1.000 ejecuciones de la prueba |
