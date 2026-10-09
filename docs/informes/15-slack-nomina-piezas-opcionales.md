# 15 · Slack preparado, nómina desde Forms y piezas opcionales

**Fecha:** 2026-10-09

## Slack: todo listo, sin conectar

El Slack de Flock no tiene lugar para dar de alta más apps, así que la integración quedó **preparada pero sin conectar** (detalle y manifiesto en [../integraciones/slack.md](../integraciones/slack.md)).

- **Programar en Slack** desde el evento o desde el botón "slack" de cualquier tarjeta: se elige la pieza (posteo, slide, credencial…), se edita el mensaje y se eligen el canal o grupo y el día y la hora. El horario se sugiere según el momento de la pieza.
- **Sin la app**, la publicación queda agendada y se ve en el Calendario. A la hora indicada aparece como "para publicar": se descarga la imagen, se copia el texto, se publica a mano y se marca como publicada. Queda registrado si se publicó a mano o por la app.
- **Con la app**, el conector ya busca canales por nombre, publica imagen y mensaje, y puede programar en Slack mismo (`chat.scheduleMessage` con la imagen subida). Así publica aunque la app esté cerrada, y cancelar también lo borra en Slack. Este último camino no se probó contra un Slack real.

## Nómina desde el formulario de inscripción

La nómina de ejemplo es una exportación de **Microsoft Forms**:

| Columna | Uso |
|---|---|
| "Nombre" | Nombre y apellido juntos |
| "Correo electrónico" | Identifica a la persona |
| "¿te sumás a participar?" | Presencial, remoto o no |

El libro trae además una hoja de control interna.

- **"Cargar nómina"** en Credenciales: subir el Excel (o un CSV) tal como sale del formulario, o pegar el link de SharePoint / OneDrive. Queda pensado para que el equipo de People lo haga sin ayuda.
- Lectura:
  - se elige sola la hoja que más personas da;
  - si no hay columna de apellido, el nombre se separa en nombre y apellido;
  - la pregunta de asistencia se detecta por el encabezado;
  - los "no" quedan afuera;
  - las respuestas duplicadas se descartan por correo.
- **Credenciales impresas solo para quien va presencial.** Los certificados son para todas las personas confirmadas.
- Con el Excel de ejemplo: 22 confirmados, 19 presenciales y 3 remotos, lo que da 19 credenciales (más 3 hojas A4) y 22 certificados.
- El Excel tiene datos personales reales: se procesa solo en la máquina local (`storage/`, fuera del repo) y no se publica.

En el camino apareció que el servidor de desarrollo, con el esquema anterior en memoria, descartaba en silencio las columnas nuevas (`email`, `attendance`). Después de cada migración hay que reiniciarlo.

## Piezas opcionales

No todos los eventos necesitan todo (por ejemplo, los certificados). Cada evento elige qué genera:

- Al crear el evento hay una sección nueva, **"4 · piezas"**. Vienen marcados LinkedIn, Slack, cronograma, credenciales y landing; los certificados vienen sin marcar.
- En el evento, **"piezas del evento · agregar o quitar"** regenera con los textos actuales. Lo que se saca se borra de la galería.
- Los eventos anteriores a esta opción siguen generando todo.

## Decisiones

D50–D51 (Slack), D52 (nómina desde Forms), D53 (piezas opcionales).
