# 05 · Publicar en GitHub Pages y generar el QR

El objetivo: que un docente escanee un código con su teléfono y la app se abra,
sin instalar nada.

---

## Antes de empezar: qué se publica y qué no

Esto es importante entenderlo, porque la consigna lo pide explícitamente.

| | Dónde vive | Quién lo ve |
|---|---|---|
| **El frontend** (HTML, CSS, JS) | GitHub Pages | todo el mundo |
| **Los datos** (cuentas, citas) | el navegador de cada persona | solo esa persona |
| **Las automatizaciones** (n8n) | tu computadora + Cloudflare Tunnel | quien tenga la dirección |
| **Las credenciales de Gmail** | dentro de n8n, en tu computadora | solo vos |

GitHub Pages **solo sirve archivos estáticos**: no ejecuta código del lado del
servidor, no tiene base de datos y no guarda nada. Por eso alojar el frontend ahí
es gratis y suficiente, pero no reemplaza a un servidor. Los servicios que sí
necesitan correr en algún lado (automatizaciones, y en el futuro la base de datos)
van aparte.

---

## Paso 1 · Comprobar que no hay secretos

```powershell
node --test pruebas/logica.test.js pruebas/flujos-n8n.test.js
```

Una de las pruebas (`no hay ningún secreto en los flujos`) revisa los `.json`
de n8n. Además, antes de subir, mirá a mano:

```powershell
git status
```

No deberían aparecer `.env`, `*.key`, ni ningún archivo de credenciales.
El `.gitignore` ya los bloquea.

---

## Paso 2 · Crear el repositorio

En <https://github.com/new>, con **tu cuenta personal**:

- Repository name: `mediconnect`
- **Public** (GitHub Pages gratis necesita que sea público)
- No marques nada más. Create repository.

---

## Paso 3 · Subirlo

Desde la carpeta `mediconnect`:

```powershell
git init
```

```powershell
git add .
```

```powershell
git commit -m "MediConnect: prototipo academico de citas medicas"
```

```powershell
git branch -M main
```

```powershell
git remote add origin https://github.com/TU-USUARIO/mediconnect.git
```

```powershell
git push -u origin main
```

> Reemplazá `TU-USUARIO` por tu usuario de GitHub.
> La primera vez te va a pedir iniciar sesión en una ventana del navegador.

---

## Paso 4 · Encender GitHub Pages

En el repositorio: **Settings → Pages**

- Source: **Deploy from a branch**
- Branch: **main** · carpeta **/ (root)**
- Save

En uno o dos minutos la dirección queda lista:

```
https://TU-USUARIO.github.io/mediconnect/
```

Abrila en el celular para comprobarla. Tiene que verse a pantalla completa, sin
el marco del teléfono y sin el panel del presentador.

---

## Paso 5 · Generar el QR público

```powershell
node herramientas/generar-qr.js https://TU-USUARIO.github.io/mediconnect/
```

Deja dos archivos:

- `assets/qr-publico.svg` — para pegar en la presentación o proyectar
- `assets/qr-publico.html` — una hoja lista para imprimir

**Escanealo con tu propio teléfono antes de la exposición.** Es la comprobación
que no se puede saltar.

### Si querés el QR ya con la automatización configurada

```powershell
node herramientas/generar-qr.js "https://TU-USUARIO.github.io/mediconnect/?n8n=https://TU-TUNEL.trycloudflare.com/webhook"
```

Así el docente no tiene que pegar nada: al abrirlo, la app queda conectada sola.
El inconveniente es que la dirección del túnel cambia cada vez, así que este QR
hay que regenerarlo el día de la exposición.

---

## Paso 6 · Cerrar el CORS

Cuando ya tengas la dirección definitiva, volvé a n8n y en **cada nodo Webhook**
cambiá *Allowed Origins (CORS)* de `*` a tu dominio:

```
https://TU-USUARIO.github.io
```

Así solo tu sitio puede mandarle eventos a tu n8n.

---

## Cómo actualizar el sitio después

```powershell
git add . ; if ($?) { git commit -m "Ajustes" }
```

```powershell
git push
```

GitHub Pages se actualiza solo en un minuto. Si no ves el cambio, es la caché:
recargá con `Ctrl+F5`, o abrí la app en una ventana de incógnito.

---

## Plan B: Netlify Drop

Si GitHub se complica el día de la exposición:

1. Entrá a <https://app.netlify.com/drop>
2. Arrastrá la carpeta `mediconnect` completa
3. Te da una dirección `https://algo.netlify.app` al instante
4. Regenerá el QR con esa dirección

No hace falta cuenta. El inconveniente: la dirección cambia en cada subida.

---

## Lista de comprobación del día de la exposición

- [ ] n8n corriendo (`iniciar-n8n.ps1`) y los **cuatro** flujos activos
- [ ] `cloudflared tunnel --url http://localhost:5678` corriendo
- [ ] La dirección nueva del túnel pegada en Ajustes de la demo
- [ ] **Probar conexión** dice "Respondió correctamente"
- [ ] El QR público abre la app en tu teléfono
- [ ] Una cita de prueba agendada y su correo recibido
- [ ] La computadora enchufada y sin suspensión automática
- [ ] Un respaldo: capturas de pantalla del correo recibido, por si se cae el internet
