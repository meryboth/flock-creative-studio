# Integración con Slack

**Estado:** preparada, sin conectar. El Slack de Flock no tiene lugar para dar de alta más apps (octubre de 2026).

## Qué funciona hoy, sin la app

- En cada evento, **Programar en Slack**: se elige cualquier pieza (posteo, slide del cronograma, credencial…), se edita el mensaje y se eligen el canal o grupo y el día y la hora. También desde el botón "slack" de cada tarjeta de la galería.
- La publicación queda agendada y se ve en el **Calendario**. A la hora indicada pasa a "para publicar": se descarga la imagen, se copia el texto, se publica a mano y se marca como publicada.
- Los canales ya usados se sugieren al escribir. Se pueden sumar fijos con `SLACK_CHANNELS=#eventos,#general` en el `.env`.

## Qué pasa al conectarla

Con `SLACK_BOT_TOKEN` en el `.env`:

- **Sin más cambios:** la app publica sola a la hora indicada (imagen + mensaje en el canal). Requiere que la app esté abierta a esa hora.
- **Con `SLACK_NATIVE_SCHEDULE=1`:** la imagen se sube a Slack al programar y el mensaje se programa en Slack mismo (`chat.scheduleMessage`). Slack lo publica aunque la app esté cerrada, y cancelar en la app también lo borra en Slack. *Este camino no está probado contra un Slack real: validarlo primero en un canal de prueba.*
- Los canales se pueden escribir por nombre (`#eventos`); la app busca su id.

## Cómo conectarla (unos 10 minutos, cuando haya lugar para la app)

1. Entrar a <https://api.slack.com/apps> → **Create New App** → **From an app manifest** → elegir el workspace de Flock.
2. Pegar este manifiesto (YAML):

```yaml
display_information:
  name: Flock Creative Studio
  description: Publica las piezas de los eventos de Flock en los canales.
  background_color: "#1f1235"
features:
  bot_user:
    display_name: Flock Creative Studio
    always_online: false
oauth_config:
  scopes:
    bot:
      - chat:write        # publicar y programar mensajes
      - files:write       # subir las imágenes
      - channels:read     # encontrar canales públicos por nombre
      - groups:read       # encontrar canales privados donde está invitada
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

3. **Install to Workspace.** Si el workspace exige aprobación, la pide un administrador.
4. Copiar el **Bot User OAuth Token** (`xoxb-…`) y pegarlo en el `.env` como `SLACK_BOT_TOKEN`. Opcionales: `SLACK_DEFAULT_CHANNEL`, `SLACK_CHANNELS` y `SLACK_NATIVE_SCHEDULE=1`.
5. En cada canal donde se vaya a publicar: `/invite @Flock Creative Studio`.
6. Reiniciar la app. En el evento, el panel de Slack pasa a decir "Slack conectado".

## Código

| Archivo | Qué hace |
|---|---|
| `apps/web/src/lib/connectors/slack.ts` | Llamadas a la API: buscar canal, subir imagen, publicar, programar y cancelar en Slack |
| `apps/web/src/lib/schedule.ts` | Programar cualquier pieza, marcar como publicada a mano, despachador de lo vencido |
| `apps/web/src/components/slack-scheduler.tsx` | El panel "Programar en Slack" |
| `apps/web/src/instrumentation.ts` | Despachador cada minuto |
