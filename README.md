# MediConnect

**Prototipo académico de una app de citas médicas.**
Proyecto integrador de *Lógica de Programación* y *Desarrollo Web*.

> David Guardado · Karol Alfaro · Kiyomi Alfaro · Caleb Galán

MediConnect muestra el recorrido completo de un paciente en una clínica privada:
buscar médico, ver solo los horarios libres, reservar, recibir la confirmación por
correo, llegar con un código QR, pasar por la consulta y agendar el control.

---

## Probarlo en 30 segundos

```bash
node herramientas/servidor.js
```

Después abrí <http://localhost:5500>.

> Hace falta un servidor (aunque sea este, de 60 líneas) porque la app usa
> módulos de JavaScript, y los navegadores no los permiten al abrir el archivo
> con doble clic.

| Dirección | Para qué sirve |
|---|---|
| `http://localhost:5500` | la app con el panel del presentador al lado |
| `?demo=0` | solo la app, como la verá un docente |
| `?demo=1` | fuerza el panel aunque sea un teléfono |
| `?hoy=2026-12-01` | finge que hoy es otro día, para ensayar |
| `?n8n=https://…` | conecta las automatizaciones sin tocar código |

---

## Qué hay en cada carpeta

```
mediconnect/
├── index.html              la app
├── comprobante.html        la página que abre el QR de una cita
├── css/                    identidad visual (base, componentes, panel)
├── js/
│   ├── app.js              el armazón: dibuja y escucha los toques
│   ├── presentador.js      el panel con los 8 casos del curso
│   ├── nucleo/             la lógica (lo importante)
│   │   ├── agenda.js         disponibilidad, reservas, cambios, check-in
│   │   ├── cuenta.js         registro, sesión y perfil
│   │   ├── almacen.js        guardado en el navegador
│   │   ├── fechas.js         zona horaria en un solo lugar
│   │   ├── qr.js             generador de QR escrito a mano
│   │   ├── calendario.js     archivo .ics y enlaces de calendario
│   │   ├── automatizacion.js el puente con n8n
│   │   ├── datos.js          catálogo ficticio
│   │   ├── estado.js         estado y navegación
│   │   └── ui.js             piezas de interfaz
│   └── pantallas/          una pantalla por archivo
├── n8n/                    los 4 flujos, exportados y sin credenciales
│   └── cloud/                versión para n8n Cloud (MC-04 sin disparador de cada minuto)
├── pruebas/                36 pruebas automatizadas
├── herramientas/           servidor local y generador del QR público
├── docs/                   diagnóstico, guías, guion y tablas
└── prototipo-original.html la versión anterior, guardada tal cual
```

---

## Comandos

```bash
node herramientas/servidor.js        # levanta la app en el puerto 5500
npm test                             # corre las 80 pruebas
node n8n/construir.js                # regenera los flujos de n8n
node herramientas/generar-qr.js URL  # genera el QR público
```

---

## La documentación

| Documento | Qué cuenta |
|---|---|
| [01 · Diagnóstico](docs/01-diagnostico.md) | qué encontramos en el prototipo anterior |
| [02 · Qué cambió](docs/02-cambios.md) | resumen de las mejoras |
| [03 · Arquitectura](docs/03-arquitectura.md) | cómo está armado y por qué |
| [04 · Conectar n8n y Gmail](docs/04-guia-n8n-gmail.md) | guía paso a paso, desde cero |
| [05 · Publicar en GitHub Pages](docs/05-publicar.md) | subir el proyecto y generar el QR |
| [06 · Guion de la demostración](docs/06-guion.md) | qué decir y en qué orden |
| [07 · Casos y conceptos](docs/07-casos-y-conceptos.md) | qué concepto del curso demuestra cada caso |
| [08 · Real, simulado y pendiente](docs/08-alcance.md) | la tabla honesta |
| [09 · Verificación](docs/09-verificacion.md) | qué se probó y qué falta probar |
| [10 · n8n Cloud](docs/10-n8n-cloud.md) | la versión en la nube, sin túnel (recomendada) |

---

## Lo importante, en una línea

**Lo que funciona de verdad:** cuentas, citas que se guardan y sobreviven a
recargar, disponibilidad que rechaza horarios ocupados, cambio y cancelación,
códigos QR escaneables, archivos `.ics` válidos y correos reales por Gmail con n8n.

**Lo que está simulado y se avisa en pantalla:** pagos, validación de seguros,
el diagnóstico, la receta, los resultados de laboratorio y la fila de la sala
de espera.

**Lo que no hay:** servidor. Las citas viven en el navegador de cada persona, así
que dos teléfonos no comparten agenda. Está explicado en
[08 · Real, simulado y pendiente](docs/08-alcance.md) y propuesto como siguiente paso.

---

## Seguridad y privacidad

- En este repositorio **no hay ningún secreto**. La app es estática: todo lo que
  contiene lo puede leer cualquiera, y por eso no contiene nada que deba ocultarse.
- Las credenciales de Gmail viven **solo dentro de n8n**, en tu propia computadora.
- La app **no pide** documento de identidad, número de tarjeta real ni información
  médica sensible.
- Las contraseñas de las cuentas de demostración no se guardan: se guarda su huella
  calculada con PBKDF2-SHA256 y una sal distinta por persona.

---

*Prototipo académico. La clínica, los médicos, los seguros, los pagos y los
resultados son ficticios.*
