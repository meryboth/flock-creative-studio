# 13 · Claude como proveedor y calendario de publicaciones

**Fecha:** 2026-10-09

## Claude como proveedor de LLM

Los tres usos de LLM (redactar textos, interpretar pedidos del chat y leer referencias con visión) pasan por un único módulo, `packages/agents/src/llm.ts`. Ese módulo prueba **proveedor por proveedor y modelo por modelo** hasta que uno responde:

- `LLM_PROVIDERS=claude,gemini`: el orden de los proveedores. Solo se usan los que tienen key (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`).
- `CLAUDE_MODELS` y `CLAUDE_VISION_MODELS`: Sonnet 5.5 primero y Haiku 5.5 de respaldo.
- Gemini sigue configurado como antes y además genera las imágenes (key visual y elementos). Claude no genera imágenes.

### Lo que apareció al integrarlo

| Problema | Solución |
|---|---|
| Los modelos Claude 5.x rechazan `temperature` | Con Claude no se envía; la consistencia la dan el prompt y el esquema cerrado |
| Sonnet 5.5 no acepta forzar una herramienta (`tool_choice`), que es como LangChain pide salida estructurada por defecto. Haiku sí, por eso al principio "funcionaba" con Haiku | Con Claude, salida estructurada nativa (`method: "jsonSchema"`) |

### Prueba con Sonnet 5.5

| Uso | Resultado | Tiempo |
|---|---|---|
| Textos (3 LinkedIn + 3 Slack + landing) | correcto, con los tres momentos | 30 s |
| Editor ("el título más grande y sacá el hashtag") | `título ×1.2` + `ocultar hashtag`, alcance todas | 5 s |
| Visión (referencia de la biblioteca) | Archivo, orbs, render 3D | 10 s |

En cada evento queda guardado qué modelo redactó los textos (`content_source`, ej. `claude:claude-sonnet-5-5`), y la página del evento lo muestra.

## Calendario

Hay una sección nueva en la barra superior, **Calendario**, con todas las publicaciones de todos los eventos en una grilla mensual:

- **Programadas** (relleno del color del canal) con su estado: programada, publicada o falló.
- **Sugeridas** (borde punteado): los momentos que todavía no se programaron, en el horario sugerido. Solo para eventos que no terminaron.
- **Día del evento** como sticker amarillo. Todo lleva a la página del evento, donde se programa.
- Filtro por canal (LinkedIn, Slack) y navegación por mes. **Mail** figura como "próximamente": no hay piezas ni conector de mail todavía.
- En el celular, la grilla pasa a una lista por día.

## Decisiones

D43 (Claude primero, Gemini de respaldo, imágenes en Gemini), D44 (calendario que muestra lo programado y lo sugerido).
