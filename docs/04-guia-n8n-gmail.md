# 04 · Conectar tu n8n y tu Gmail personal

Esta guía es para montar **tu propio entorno**, con tus recursos.
No se usa ni se toca nada de la Fundación Gloria de Kriete: ni su n8n, ni sus
credenciales, ni su correo, ni sus flujos.

**Costo total: $0.**

---

## Lo que vamos a armar

```
  Teléfono del docente                Tu computadora
  ┌──────────────┐                   ┌──────────────────────┐
  │  MediConnect │ ── https ──┐      │  n8n (puerto 5678)   │
  │  (GitHub     │            │      │   · MC-01 registro   │
  │   Pages)     │            │      │   · MC-02 reserva    │
  └──────────────┘            │      │   · MC-03 cambio     │
                              │      │   · MC-04 recordatorio│
                  Cloudflare  └────► │                      │
                  Tunnel             └──────────┬───────────┘
            (una dirección https                │
             pública y gratis)                  │  Gmail OAuth2
                                                ▼
                                        Tu Gmail personal
```

**Por qué hace falta el túnel:** la app vive en internet (GitHub Pages) y tu n8n
vive en tu computadora. Para que la app pueda avisarle a n8n, n8n necesita una
dirección pública con `https`. Cloudflare Tunnel crea esa dirección gratis, sin
tocar el módem ni abrir puertos.

**La limitación, dicha clara:** esto funciona mientras tu computadora esté
encendida con n8n y el túnel corriendo. Para el día de la exposición es
suficiente, y es lo que se enciende 10 minutos antes de presentar.

---

## Parte 1 · Instalar tu n8n (10 minutos)

### 1.1 Instalar

Si todavía no lo tenés:

```powershell
npm install -g n8n
```

### 1.2 Usar una carpeta de datos propia para MediConnect

Esto es importante: así tu n8n de MediConnect queda **separado** de cualquier
otro n8n que ya tengas, con sus propias credenciales y sus propios flujos.

El proyecto ya trae el lanzador listo en `herramientas/iniciar-n8n.ps1`.
Apunta a `$HOME\mediconnect-n8n`, así que tu n8n de MediConnect queda
**separado** de cualquier otro que ya tengas, con sus propias credenciales y
sus propios flujos.

```powershell
powershell -ExecutionPolicy Bypass -File .\herramientas\iniciar-n8n.ps1
```

Para detenerlo: `Ctrl + C` en esa ventana.

La primera vez n8n te va a pedir crear una cuenta de dueño (tu correo y una
contraseña). Es una cuenta **local**, solo tuya, y no sale de tu computadora.

Abrí <http://localhost:5678>.

### 1.3 Importar los cuatro flujos

En n8n: **Workflows → ⋯ → Import from File**, y elegí uno por uno:

| Archivo | Qué hace |
|---|---|
| `n8n/MC-01-registro.json` | correo de bienvenida al crear la cuenta |
| `n8n/MC-02-reserva.json` | confirmación de la cita, con el `.ics` adjunto |
| `n8n/MC-03-cambio-cancelacion.json` | aviso de cambio de fecha o de cancelación |
| `n8n/MC-04-recordatorio.json` | recordatorio antes de la cita |

Los cuatro vienen **sin credenciales**: en el nodo de Gmail vas a ver un aviso de
"credential not set". Eso se arregla en la parte 2.

---

## Parte 2 · Conectar tu Gmail con OAuth2 (20 minutos la primera vez)

OAuth2 es el mecanismo oficial de Google. No se maneja ninguna contraseña:
vos autorizás a tu propio n8n desde tu cuenta, y podés quitarle el permiso
cuando quieras.

> **Nunca escribas tu contraseña de Gmail en el chat, en el código ni en el
> repositorio.** Todo lo de esta parte se hace en las páginas de Google y
> dentro de n8n.

### 2.1 En n8n: copiar la dirección de retorno

1. En n8n, abrí **Credentials → Add credential → Gmail OAuth2 API**.
2. Copiá el **OAuth Redirect URL** que te muestra.
   Se ve así: `http://localhost:5678/rest/oauth2-credential/callback`
3. Dejá esa pestaña abierta.

### 2.2 En Google Cloud: crear el proyecto

1. Entrá a <https://console.cloud.google.com/> con **tu Gmail personal**.
2. Arriba, **Select a project → New Project**.
   Nombre: `MediConnect`. Create.
3. Con el proyecto seleccionado, andá a
   **APIs & Services → Library**, buscá **Gmail API** y tocá **Enable**.

### 2.3 Configurar la pantalla de consentimiento

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create.
3. Llená lo mínimo:
   - App name: `MediConnect`
   - User support email: tu Gmail
   - Developer contact: tu Gmail
4. **Scopes**: podés saltarlo (Save and Continue).
5. **Test users → Add users**: agregá **tu propio Gmail**.
   Esto es clave: mientras la app esté en modo prueba, solo los correos de esta
   lista pueden autorizarla. Con el tuyo alcanza.
6. Save.

### 2.4 Crear las credenciales

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `n8n MediConnect`.
4. En **Authorized redirect URIs → Add URI**, pegá la dirección que copiaste
   de n8n en el paso 2.1.
5. Create.
6. Google te muestra un **Client ID** y un **Client Secret**.

### 2.5 Pegarlos en n8n

1. Volvé a la pestaña de n8n con la credencial Gmail OAuth2 abierta.
2. Pegá el **Client ID** y el **Client Secret**.
3. Ponele de nombre a la credencial: **`Gmail personal MediConnect`**
   (los flujos buscan ese nombre; si usás otro, acordate de elegirlo a mano en
   cada nodo de Gmail).
4. Tocá **Sign in with Google**, elegí tu cuenta y aceptá.
   Google va a avisar que la app no está verificada: es normal, es tuya.
   Tocá **Advanced → Go to MediConnect (unsafe)** y continuá.
5. Cuando diga **Account connected**, guardá.

### 2.6 Asignar la credencial en los cuatro flujos

En cada flujo, abrí el nodo de Gmail y elegí la credencial
`Gmail personal MediConnect`:

- MC-01 → *Enviar bienvenida (Gmail)*
- MC-02 → *Enviar confirmación (Gmail)*
- MC-03 → *Enviar aviso (Gmail)*
- MC-04 → *Enviar recordatorio (Gmail)*

Guardá cada flujo.

---

## Parte 3 · Activar los flujos

Arriba a la derecha de cada flujo hay un interruptor **Inactive / Active**.
Activá los cuatro.

> **MC-04 tiene que quedar activo sí o sí.** Es el que revisa cada minuto a quién
> le toca el recordatorio; si está inactivo, el disparador de tiempo no corre.

---

## Parte 4 · La dirección pública con Cloudflare Tunnel

### 4.1 Instalar

```powershell
winget install --id Cloudflare.cloudflared
```

Queda en `C:\Program Files (x86)\cloudflared\cloudflared.exe`. Si `cloudflared`
no te responde en la terminal, abrí una ventana nueva de PowerShell (el PATH se
actualiza solo al abrirla) o usá la ruta completa.

### 4.2 Levantar el túnel

Con n8n corriendo, en **otra** ventana de PowerShell:

```powershell
cloudflared tunnel --url http://localhost:5678
```

A los pocos segundos imprime algo como:

```
  Your quick Tunnel has been created! Visit it at:
  https://silly-brave-tiger-example.trycloudflare.com
```

Esa es tu dirección pública. **Cambia cada vez que levantás el túnel**, por eso
la app te deja pegarla sin tocar código.

### 4.3 Decirle a la app cuál es

La dirección del webhook es la del túnel **más `/webhook`**:

```
https://silly-brave-tiger-example.trycloudflare.com/webhook
```

Dos formas de configurarla:

**a) Desde la app** (la recomendada, funciona también en el teléfono)
Perfil → **Ajustes de la demo** → pegá la dirección → **Probar conexión** → Guardar.

**b) Por la dirección del navegador**, útil para repartirla ya configurada:

```
https://tu-usuario.github.io/mediconnect/?n8n=https://silly-brave-tiger-example.trycloudflare.com/webhook
```

---

## Parte 5 · Comprobar que funciona

1. En la app: **Perfil → Ajustes de la demo → Probar conexión**.
   Tiene que decir *"Respondió correctamente"*.
   En n8n, MC-01 va a mostrar una ejecución nueva.
2. Creá una cuenta con **tu** correo → te llega la bienvenida.
3. Agendá una cita → te llega la confirmación con el `.ics` adjunto.
   En la app, la tarjeta de la cita tiene que decir
   *"Confirmación enviada a tu correo"*.
4. Cambiá la cita → llega el aviso con la fecha vieja y la nueva.
5. Cancelala → llega el aviso de cancelación.
6. Recordatorio en vivo: Ajustes de la demo → poné **1 min** → en el panel del
   presentador tocá **Probar recordatorio** → esperá un minuto.

---

## Si algo falla

| Lo que ves | Qué suele ser | Cómo se arregla |
|---|---|---|
| "No se pudo conectar con la automatización" | el túnel se cayó o cambió de dirección | volvé a correr `cloudflared` y pegá la dirección nueva en Ajustes |
| "El servidor respondió 404" | el flujo está inactivo, o falta `/webhook` al final | activá el flujo; revisá que la dirección termine en `/webhook` |
| "El servidor respondió 500" | el nodo de Gmail falló | abrí la ejecución en n8n y mirá el error del nodo |
| Llega la respuesta pero no el correo | la credencial no está asignada en ese nodo | abrí el nodo Gmail y elegí `Gmail personal MediConnect` |
| Google dice "access_denied" | tu correo no está en *Test users* | agregalo en OAuth consent screen → Test users |
| "invalid_grant" al autorizar | la Redirect URI no coincide | tiene que ser **idéntica** a la que muestra n8n |
| El recordatorio nunca llega | MC-04 está inactivo | activalo; el disparador de tiempo solo corre si el flujo está activo |
| La app no manda nada y no da error | la dirección está vacía | la app lo dice: "Correo no configurado en esta demo" |

---

## Seguridad: lo que hay que saber

- **La dirección del webhook no es un secreto**, igual que la dirección de un
  formulario. Pero cualquiera que la tenga puede mandarle eventos. Para una
  demostración de clase está bien; en algo real se le pondría una firma o un
  token.
- **El `Access-Control-Allow-Origin` está en `*`** para que funcione mientras
  probás. Cuando publiques el sitio, en cada nodo Webhook cambiá
  *Allowed Origins (CORS)* por tu dominio exacto
  (`https://tu-usuario.github.io`).
- **Las credenciales de Gmail viven solo dentro de n8n**, en tu computadora.
  Los archivos `.json` de este repositorio no las contienen: por eso al
  importarlos aparecen vacías. Es a propósito.
- **Para quitarle el permiso a n8n** en cualquier momento:
  <https://myaccount.google.com/permissions>.

---

## Alternativa: SMTP con contraseña de aplicación

Si OAuth2 se complica, hay un camino más corto: activar la verificación en dos
pasos en tu Gmail, generar una **contraseña de aplicación** de 16 letras en
<https://myaccount.google.com/apppasswords>, y usar en n8n una credencial
**SMTP** (`smtp.gmail.com`, puerto 465, SSL) con tu correo y esa contraseña.
Después, en cada flujo, cambiá el nodo *Gmail* por **Send Email**.

Es más rápido, pero es una credencial más débil: cualquiera que la tenga puede
mandar correos como vos. Si la usás, **nunca** la escribas fuera de n8n.
