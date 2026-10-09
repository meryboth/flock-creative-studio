# 12 · Accionables por pieza: publicar, descargar, sincronizar

**Fecha:** 2026-10-09

## Qué se buscaba

Que cada grupo de piezas termine en una **acción**, no solo en un archivo:

- **LinkedIn:** comunicar el evento en tres momentos (**se viene, está pasando, ya pasó**) y programar esas publicaciones.
- **Slack:** piezas gráficas para los canales internos, también programables.
- **Credenciales:** descargarlas todas juntas en .zip y sincronizarlas con la nómina.

## Contenido por momentos

Gemini ahora redacta:

| Canal | Antes | Durante | Después |
|---|---|---|---|
| LinkedIn (público) | `anuncio`: qué es, cuándo y por qué importa | `en-vivo`: en presente, qué se está viviendo | `gracias`: balance y agradecimiento, sin inventar cifras |
| Slack (interno, más corto) | `anuncio`: agendalo | `hoy`: es hoy, dónde y a qué hora | `gracias`: gracias por sumarte |

Cada pieza lleva su momento (`moment`) y la galería lo muestra como sticker. Los eventos anteriores, con posteos "anuncio, agenda, gracias" y sin Slack, se redactan de nuevo al regenerar. Las piezas de Slack usan la misma plantilla que el posteo apaisado (1200×627, se lee bien en el canal) y el editor conversacional también puede cambiar sus textos.

## Programar publicaciones

- **Horarios sugeridos (hora de Buenos Aires):** LinkedIn una semana antes a las 10:00, el día del evento una hora después de que arranca la agenda y al día siguiente a las 10:00. Slack tres días antes, el mismo día a las 9:00 y al día siguiente. Si la fecha sugerida ya pasó, se propone la próxima hora en punto. Todo se puede mover.
- **Tabla `scheduled_posts`:** canal, momento, pieza, texto, destino, fecha, estado (programada, publicando, publicada, falló, cancelada), link externo y error. Hay una sola programación activa por momento; reprogramar cancela la anterior.
- **Despachador:** `instrumentation.ts` arranca un intervalo de un minuto que publica lo vencido. Toma cada publicación con un cambio de estado condicional, así nunca sale dos veces. Al publicar usa **el texto vigente**, por si se editó en el chat después de programar.
- **Sin conector se programa igual:** si vence sin tokens, queda programada con el aviso "se publica apenas se conecte".

### Conectores

| Canal | Cómo publica | Qué falta |
|---|---|---|
| Slack | Subida externa de archivos (`files.getUploadURLExternal` + `files.completeUploadExternal` con el mensaje como comentario) | Una app interna de Slack con bot token (`files:write`, `chat:write`), invitada al canal |
| LinkedIn | Posts API: registra y sube la imagen, crea el post. El texto pasa a formato "little text" (hashtags como links) | Una app de LinkedIn con `w_organization_social` para la página de Flock (o `w_member_social` para un perfil) |

**Por qué programación propia:** `chat.scheduleMessage` de Slack no admite archivos, y la API de LinkedIn no expone programación. Con el despachador local, las dos redes funcionan igual. La limitación es que la app tiene que estar levantada a la hora de publicar. Si pasa a un servidor, el despachador se mueve a un worker sin cambiar la tabla.

**Estado:** el código de los conectores está escrito según la documentación de cada API, pero **no se probó contra Slack ni LinkedIn reales** porque faltan los tokens. Sí se probó el circuito local: programar, reprogramar, cancelar y el aviso por falta de conector.

## Credenciales

- **Descargar todas (.zip):** PNG por persona más las hojas A4 en PDF, armado al vuelo con fflate. El encabezado del evento suma "Descargar todo (.zip)" con la familia completa.
- **Sync con la nómina:** se pega el link del Excel de SharePoint u OneDrive, se lee (columnas nombre y apellido o nombre_completo, y opcionalmente área y rol), se reemplazan los asistentes del evento y se regeneran credenciales y certificados. El link queda guardado y se sugiere en los eventos siguientes.
  - **Hoy** funciona con links que no piden iniciar sesión. Con una nómina privada, SharePoint pide login y la app explica que hace falta la app de Entra ID (D19). Ese sigue siendo el camino recomendado, porque compartir la nómina "con cualquiera que tenga el link" expone datos personales.
  - Por seguridad, el servidor solo descarga de hosts `*.sharepoint.com`, `onedrive.live.com` y `1drv.ms`.

## Decisiones

D39 (momentos), D40 (programación propia), D41 (sync con la nómina), D42 (zip al vuelo).
