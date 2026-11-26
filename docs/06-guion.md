# 06 · Guion de la demostración

Duración objetivo: **12 minutos** de exposición + 3 de preguntas.
Se puede recortar a 8 saltando los bloques marcados *(opcional)*.

**Quién hace qué:** una persona narra, otra maneja el teléfono (o el navegador
proyectado) y una tercera queda atenta al panel del presentador para encender
los escenarios. La cuarta responde preguntas.

---

## Antes de entrar al aula

- [ ] n8n corriendo y los cuatro flujos activos
- [ ] Túnel levantado y su dirección pegada en Ajustes de la demo
- [ ] "Probar conexión" → *Respondió correctamente*
- [ ] QR público proyectado o impreso
- [ ] Un correo de prueba ya recibido (respaldo por si se cae el internet)
- [ ] Datos de la demo reiniciados (Panel → **Reiniciar recorrido**)

---

## Minuto 0 – 1 · El problema tiene nombre

> *(Diapositiva con Takashi y David, la del bosquejo anterior.)*

**Decir:**

> "Esta es la historia de dos personas.
>
> **Takashi** es médico. Es bueno y tiene clientes de años, así que su flujo de
> pacientes es muy alto. Trabaja con seguros empresariales, y eso le suma
> papeleo a cada consulta.
>
> **David** es su paciente. David **odia tener que llamar** para agendar una cita.
> No entiende bien el proceso del seguro. El papeleo lo estresa. Y encima
> **olvida darle seguimiento** a sus citas.
>
> El problema no es la medicina. El problema es **todo lo que pasa alrededor**
> de la medicina: la llamada, la fila en recepción, la fila en caja, el papel que
> se pierde, el control que nunca se agenda.
>
> Nosotros nos preguntamos: ¿cuánto de eso se puede resolver con lógica y con
> una pantalla bien pensada?"

---

## Minuto 1 – 2 · Que lo prueben ellos

**Mostrar el QR y decir:**

> "Antes de que les contemos nada más, escaneen este código. Se les abre en el
> teléfono, no hay que instalar nada **y no hay que registrarse para empezar**.
> Eso fue una decisión: el registro llega cuando hace falta guardar algo, no en
> la puerta."

> *(Darles 30 segundos. Que toquen.)*

---

## Minuto 2 – 5 · El camino feliz

> *(Panel → **Flujo completo**, o seguir con el teléfono.)*

| Qué se hace | Qué se dice |
|---|---|
| Bienvenida → **Empezar a explorar** | "Entramos sin cuenta. Esto ya es una decisión de producto." |
| Inicio | "La app saluda, y lo primero que muestra es **la próxima cita**. Eso ataca directo el 'olvida darle seguimiento'." |
| **Nueva cita** | "Buscamos médico. Se puede filtrar por especialidad, y si uno tiene seguro, ver solo los que lo cubren." |
| Tocar un médico | "Acá está lo importante: **estos horarios no son un dibujo**." |
| Señalar los tachados | "Los tachados ya están tomados. La app **no te deja** elegirlos: el botón no reacciona. En el prototipo anterior se podía tocar cualquiera." |
| Elegir hora → **Continuar** | "Revisamos antes de confirmar: médico, fecha, hora, consultorio y cuánto se paga." |
| Confirmar | "Y aquí sí aparece la cuenta: 'para guardarla a tu nombre y mandarte el correo'. También se puede seguir como invitado." |
| Crear cuenta | "Ocho caracteres con letras y números. La contraseña **no se guarda**: se guarda su huella con PBKDF2." |
| Confirmar cita | "Listo." |

**En la pantalla de la cita, señalar tres cosas:**

> "Tres cosas que son reales, no dibujos:
>
> 1. **El código QR** se puede escanear. Lo escribimos nosotros, sin librerías,
>    y lo comprobamos contra un decodificador de verdad.
> 2. **El estado del correo**. Dice exactamente qué pasó: enviado, enviando,
>    falló o no configurado. Nunca dice 'enviado' si no se envió.
> 3. **Agregar al calendario** descarga un archivo `.ics` de verdad. Y fijate que
>    el botón dice 'descargar', no 'agregada': la app **no puede** agregar un
>    evento a tu calendario personal sin que vos lo confirmes, así que no lo dice."

> *(Mostrar el correo que acaba de llegar, en el teléfono.)*

> "Ese correo lo mandó n8n, desde nuestro Gmail personal, con el archivo del
> calendario adjunto."

---

## Minuto 5 – 7 · Lo que puede salir mal

Aquí entran los casos del curso. **El valor está en los errores, no en el camino feliz.**

> *(Panel → **C1 · Agendar sin cupos**)*

> "El miércoles está lleno. La app no se limita a decir 'no'. Dice **cuál es el
> siguiente horario libre** y te lleva ahí de un toque. Un error bien resuelto es
> una decisión de diseño, no solo un `if`."

> *(Panel → **C4a · Póliza vencida**)*

> "El seguro aparece vencido. Fijate en la frase: **'no se hizo ningún cobro y tu
> horario sigue apartado'**. Eso es lo que uno quiere leer cuando algo falla."

> *(Panel → **C4c · Pago rechazado**, y tocar Pagar)*

> "El banco rechaza la tarjeta. La cita **todavía no se había guardado**, así que
> no hay nada roto que limpiar. Se puede reintentar, usar otra tarjeta o pagar en
> caja."

> *(Señalar la etiqueta gris "SIMULADO")*

> "Todo lo del pago está marcado como simulado, en la pantalla, a la vista. No
> queremos que nadie crea que cobramos de verdad."

---

## Minuto 7 – 9 · El día de la cita

> *(Panel → **C2**, y tocar "Ya llegué · hacer check-in")*

> "Llega el día. El QR hace el check-in y el paciente pasa directo a la sala, sin
> fila en recepción. **El pase sirve una sola vez**: si se intenta otra vez, lo
> rechaza. Y si la cita se canceló, tampoco sirve."

> *(Dejar que la fila avance sola, o Panel → Avanzar la fila)*

> "La fila avanza. El paciente no tiene que estar sentado: le avisamos."

> *(Panel → **C6 · Requiere laboratorio**)*

> "El médico ordena un examen. La orden viaja sola al laboratorio y el resultado
> llega al expediente. Sin papel que se pierda."

> *(Panel → **C7 · Cierre y expediente**)*

> "Diagnóstico, receta a la farmacia, pago y calificación. Todo en un lugar."

---

## Minuto 9 – 10 · El ciclo se cierra

> *(En el resumen: **Elegir fecha**)*

> "Y acá está la parte que resuelve el 'olvida darle seguimiento' de David:
> el médico sugiere volver en una semana, y el calendario ya viene con esa fecha
> marcada. El ciclo **vuelve a empezar desde la agenda**, que es exactamente el
> caso 8 de nuestro bosquejo original."

---

## Minuto 10 – 11 · Lo que hay por dentro *(opcional)*

> *(Señalar el **Registro de la lógica** del panel.)*

> "Este panel no es decoración: va escribiendo las decisiones que toma la app
> mientras la usamos. Ahí se lee literal:
>
> `¿seguro vigente Y médico lo acepta? SÍ → $0`
> `cita MC-J4T8RV AGENDADA · 2026-11-23 09:00`
> `reservar() · clave de idempotencia repetida → no se duplicó`
>
> Eso último es nuestro favorito. Si uno toca 'Confirmar' dos veces rápido,
> **no se crean dos citas**: cada intento lleva una clave única y el segundo se
> reconoce como repetido. Es el mismo truco que usan los sistemas de pago."

---

## Minuto 11 – 12 · Qué es real y qué no

**Decir, sin adornos:**

> "Queremos ser claros con el alcance, porque creemos que eso también es parte
> del trabajo.
>
> **Funciona de verdad:** las cuentas, las citas que se guardan y sobreviven a
> cerrar el navegador, la disponibilidad que rechaza horarios ocupados, el cambio
> y la cancelación, los QR escaneables, los archivos de calendario y los correos.
>
> **Está simulado y lo decimos en pantalla:** los pagos, la validación del seguro,
> el diagnóstico, la receta y los resultados.
>
> **Lo que falta:** un servidor. Hoy cada teléfono guarda sus propias citas, así
> que dos personas no comparten agenda. Toda la lógica de conflictos ya está
> escrita y probada; lo que falta es mudarla a una base de datos compartida.
> Eso es lo que haríamos en la siguiente etapa, y es también lo que nos permitiría
> validar el seguro contra la aseguradora de verdad."

---

## Preguntas que probablemente van a hacer

**"¿Esto se podría usar en una clínica real?"**
> Hoy no. Le falta el servidor y le falta la parte legal: un expediente médico real
> tiene requisitos de resguardo y de consentimiento que no abordamos. Lo que sí es
> reutilizable es la lógica de agenda: las reglas de disponibilidad, conflictos,
> cambios y cancelación están escritas y probadas.

**"¿Por qué no usaron un framework?"**
> Porque el proyecto es de lógica y de desarrollo web, y queríamos que se viera la
> lógica. Son unas 6.100 líneas de JavaScript sin librerías: el estado, el ruteo,
> el generador de QR y el generador de `.ics` están escritos por nosotros. Un
> framework nos habría escondido justo lo que queríamos mostrar.

**"¿El código QR es de verdad o es un dibujo?"**
> Es de verdad. Lo pueden escanear ahora. Lo comprobamos de dos maneras:
> comparamos nuestras matrices con las de una librería conocida (24 de 24
> idénticas) y después las volvimos a leer con un decodificador (24 de 24
> correctas).

**"¿Dónde quedan mis datos si yo pruebo la app?"**
> En su teléfono, en el almacenamiento del navegador. No hay servidor. Si borran
> los datos del sitio, desaparecen. Lo único que sale es el aviso que la app le
> manda a nuestro n8n para enviar el correo: nombre, correo y datos de la cita.
> Nada médico.

**"¿Y si no hay internet el día de la presentación?"**
> La app funciona igual: se puede recorrer todo, agendar y ver el QR. Lo único
> que no pasa es el correo, y la pantalla lo dice: "No se pudo enviar el correo.
> Tu cita sigue guardada."

**"¿Cuánto costó?"**
> Cero. GitHub Pages es gratis, n8n corre en una computadora nuestra y el túnel
> de Cloudflare es gratis.

---

## Si algo se cae en vivo

| Qué pasa | Qué hacer y qué decir |
|---|---|
| No hay internet | Seguir con la app local. "Esto funciona sin conexión; lo único que no sale es el correo, y la app lo dice." |
| El correo no llega | Mostrar la captura de respaldo y señalar el estado real en la app. **No decir que llegó.** |
| El túnel se cayó | Seguir sin automatizaciones. La app avisa sola. |
| Datos raros de pruebas anteriores | Panel → **Reiniciar recorrido**. Si hace falta más: Ajustes → Borrar todos los datos. |
| El teléfono de un docente no escanea | Dictar la dirección corta, o pasarla por el chat del aula. |
