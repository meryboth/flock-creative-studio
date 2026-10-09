# Flock Creative Studio: propuesta técnica v0.2

> Orquestador local de agentes para que **People Experience** genere la identidad y las piezas gráficas de los eventos internos de Flock IT, que hoy se encargan a la agencia BrandBox.
> Documento vivo. Cambios respecto de v0.1 al final.

---

## 1. Contexto y problema

- Flock hace 1 o 2 eventos grandes por año. Cada uno tiene una **temática** (por ejemplo, *Outdoor* o *AI Day*).
- Con la temática definida, People Experience pide a BrandBox una identidad del evento y un set de piezas. El proceso es lento, cuesta caro y deja poco margen para iterar.
- **Objetivo:** que People Experience pueda, en una tarde, ir de *temática + moodboard* a *identidad del evento + piezas listas*, eligiendo entre propuestas e iterando sobre ellas.

## 2. Qué aprendimos de las piezas del AI Day 2026

Referencias guardadas en [`references/ai-day-2026/`](../references/ai-day-2026/).

| Elemento | Qué se ve | Implicancia técnica |
|---|---|---|
| **Key visual** | Objeto 3D iridiscente (flor de cromo azul, violeta y rosa), recortado y apoyado contra los bordes | Es **la** pieza generativa: se crea una vez y se reusa en todo. Necesita **fondo transparente** |
| Profundidad | Copias del mismo objeto muy desenfocadas en las esquinas | Se hace **por código** (CSS `filter: blur`), no con IA |
| Fondo | Degradado radial azul/navy (certificado) o negro plano (cronograma) | Tokens de diseño; variantes oscuras |
| Tipografía | Display *extended* en mayúsculas con mucho tracking (titulares, hashtag) + sans legible para el cuerpo | Catálogo cerrado de fuentes con licencia; la IA elige, no inventa |
| Componentes | Pill con contorno (fecha), caja redondeada con contorno (bloque horario) | Componentes de plantilla reutilizables |
| Constantes | Logo Flock arriba a la izquierda, `#FLOCKAIDAY`, tagline *LEARN · EXPERIMENT · EVOLVE TOGETHER* | Parte del **Event Kit** |
| Piezas por lote | Una slide por bloque horario; un certificado por persona | Generación **masiva desde datos** (CSV/tabla), sin IA por pieza |

**Conclusión:** un evento = **un sistema de identidad** (key visual + paleta + tipografías + componentes + copy base) aplicado a muchas plantillas. La IA aporta valor en la *exploración de la identidad*. Las piezas se derivan de forma determinística.

## 3. Principios de diseño

1. **Primero la identidad, después las piezas.** No se genera ninguna pieza hasta que el usuario elige una dirección creativa y la bloquea.
2. **La IA de imágenes genera objetos, no piezas.** Nunca escribe texto ni dibuja el logo. La composición la hace código con HTML/CSS.
3. **Iterar con opciones, no con prompts.** El usuario elige entre 3 propuestas, da feedback corto ("más violeta", "otro objeto"), **bloquea** lo que le gusta y regenera solo el resto.
4. **Datos aparte de la creatividad.** Agenda y lista de flockers entran como tabla o CSV. Mil credenciales no cuestan mil llamadas a la IA.
5. **Local primero y proveedores intercambiables.** Gemini para empezar; ComfyUI y Ollama como alternativas locales con la misma interfaz.

## 4. Inputs y outputs

### Inputs
| Input | Formato | Uso |
|---|---|---|
| Brief | texto libre (formulario guiado: nombre, temática, fecha, lugar/modalidad, tono, audiencia) | todos los agentes |
| **Moodboard** | 1–15 imágenes (subidas, pegadas o de eventos anteriores) | análisis de estilo y referencia visual para generar el key visual |
| Brand kit Flock | logo SVG (variantes), colores, fuentes, reglas | fijo para todos los eventos |
| Agenda | tabla editable en la UI o CSV (`hora_inicio, hora_fin, titulo, speaker, sala`) | cronograma, landing |
| Flockers | CSV (`nombre, apellido, area, rol, foto?`) | credenciales (y certificados) |

### Outputs v1
| Output | Contenido | Formato |
|---|---|---|
| **Posteos de LinkedIn** | 3–4 momentos: *teaser / save the date*, *agenda*, *speakers* (opcional) y *recap / gracias*. Cada uno con **imagen + texto del post + hashtags** | PNG 1200×627 o 1080×1350, `.txt`/`.md` del copy |
| **Landing page** | Hero con key visual, qué es, fecha y lugar, agenda, CTA | **un solo `.html` autocontenido** (imágenes en base64, fuentes embebidas) |
| **Cronograma** | (a) una slide por bloque, como las referencias; (b) una pieza resumen con toda la agenda | PNG 1920×1080 por bloque, PNG/PDF resumen |
| **Credenciales** | una por flocker: nombre, área, rol, key visual, logo; opcional foto y QR | PDF de impresión (A6/CR80 con marcas de corte, varias por hoja) + PNG individuales |

**Fácil de sumar después:** certificados (ya hay referencia), fondos de Teams/Zoom, firma de email, stories, merch, pantallas del venue.

## 5. Flujo del usuario

```
 ① Brief + moodboard
        │
        ▼
 ② Análisis del moodboard ──► el usuario ve "lo que entendimos" (paleta, mood, objetos, tipografía) y corrige
        │
        ▼
 ③ 3 DIRECCIONES CREATIVAS  ◄──────────────┐
    cada una: key visual + paleta +        │  feedback por dirección
    tipografías + hashtag/tagline +        │  "bloquear" elementos
    preview en 2 piezas de muestra         │  mezclar (key visual de A + paleta de B)
        │ el usuario elige ───────────────┘
        ▼
 ④ EVENT KIT bloqueado (tokens + key visual y variantes + copy base)
        │
        ▼
 ⑤ Piezas en paralelo: LinkedIn · Landing · Cronograma · Credenciales
        │
        ▼
 ⑥ QA automático ──► galería: aprobar / regenerar pieza con feedback / editar texto
        │
        ▼
 ⑦ Exportar ZIP (por canal) + Event Kit reutilizable
```

## 6. Workflow de agentes (LangGraph)

El grafo tiene **dos sub-grafos**, separados por un checkpoint humano:

### A. Exploración de identidad
| Nodo | Tipo | Modelo | Hace |
|---|---|---|---|
| `briefAnalyst` | LLM | Gemini Flash | brief libre → `EventBrief` (Zod) |
| `moodboardAnalyst` | LLM con **visión** | Gemini Flash/Pro | imágenes → `StyleProfile` (paleta HEX, materiales, iluminación, motivos, mood, vibe tipográfico) |
| ⏸ `confirmStyle` | humano | — | corrige el análisis |
| `creativeDirector` | LLM | Gemini Pro | 3 `CreativeDirection`: concepto, prompt del key visual, paleta (validada contra la marca Flock), par de fuentes del catálogo, hashtag, tagline, layout family |
| `keyVisualGenerator` | imagen | Gemini Image / ComfyUI | 2 variantes del objeto por dirección, usando el moodboard como referencia, sobre fondo plano |
| `cutout` | procesamiento | BiRefNet/RMBG (local) | recorte con alpha + upscale |
| `previewComposer` | código | Playwright | renderiza 2 piezas de muestra por dirección (por ejemplo, post y slide) |
| ⏸ `selectDirection` | humano | — | elegir, mezclar, bloquear o pedir cambios → vuelve a `creativeDirector`/`keyVisualGenerator` **solo** para lo no bloqueado |
| `kitBuilder` | código | — | consolida el **Event Kit** (tokens, assets y variantes de blur/crop, copy base) |

### B. Producción de piezas (en paralelo, con `Send` de LangGraph)
| Nodo | Tipo | Hace |
|---|---|---|
| `linkedinCopywriter` | LLM | texto de cada post (tono Flock, largo, emojis según config, hashtags) + titular de la imagen |
| `landingWriter` | LLM | secciones de la landing (JSON); el HTML sale de una plantilla |
| `agendaFormatter` | LLM liviano o código | normaliza la agenda y acorta títulos que no entran |
| `badgeBatch` | código | una credencial por fila del CSV (sin LLM) |
| `composer` | código | plantilla + Event Kit + datos → PNG/PDF/HTML |
| `brandQA` | código + LLM visión | código: contraste WCAG, overflow de texto, márgenes del logo. LLM: "¿se ve bien? ¿algo tapa el texto?" |
| ⏸ `review` | humano | aprobar / regenerar con feedback / editar texto inline |
| `exporter` | código | ZIP + `manifest.json` |

**Estado persistido** con `PostgresSaver`: se puede cerrar el navegador y retomar el evento días después.

## 7. Modelos: ¿hace falta ComfyUI?

### Hardware disponible (esta Mac)
Apple **M3 Pro, 18 GB** de memoria unificada, **~41 GB libres** en disco. ComfyUI Desktop y Ollama (`gpt-oss:20b`, 13 GB) ya están instalados.

### Evaluación para generar el key visual

| Opción | Calidad para "objeto 3D iridiscente" | Usa el moodboard como referencia | Velocidad en esta Mac | Costo | Comentario |
|---|---|---|---|---|---|
| **Gemini Image** (familia *Nano Banana*, vía API) | muy buena | sí, multimodal (varias imágenes de referencia) y edición conversacional | segundos | por imagen (bajo) | **la mejor relación esfuerzo/resultado para el MVP** |
| ComfyUI + **SDXL** + IP-Adapter | buena | sí (IP-Adapter / estilo) | ~40–90 s/imagen | gratis | entra en 18 GB; requiere ajustar el workflow |
| ComfyUI + **Flux.1 schnell** (GGUF Q4/Q5) + Redux | muy buena | sí (Redux) | ~1–3 min/imagen | gratis | licencia Apache 2.0, apta para uso en la empresa |
| ComfyUI + Flux.1 dev / Kontext | excelente | sí | lenta, al límite de memoria | gratis | **revisar licencia** para uso corporativo; pesado para 18 GB y el disco disponible |

### Recomendación
- **MVP: Gemini** para texto, visión e imagen. Es la forma más rápida de validar el producto con People Experience.
- **ComfyUI sí, pero en tareas puntuales, no como motor principal al inicio:**
  1. **`cutout.json`**: BiRefNet/RMBG + upscale. Es liviano, local y mejor que pedirle transparencia a Gemini. **Entra en el MVP.**
  2. **`keyvisual_offline.json`**: SDXL o Flux schnell + IP-Adapter/Redux con el moodboard. Alternativa 100% local (fase 6).
  3. **`variation.json`**: variaciones del objeto elegido manteniendo la forma (img2img o ControlNet depth).
- La app llama a ComfyUI por su **API HTTP** (`/prompt`, `/history`, websocket) con workflows guardados en `comfy/workflows/*.json` (formato API). Si ComfyUI no está corriendo, el recorte cae a una librería local (`@imgly/background-removal-node`).
- **No correr Ollama y ComfyUI al mismo tiempo** con modelos grandes: con 18 GB no entran los dos.

### Modelos por tarea
| Tarea | Principal | Alternativa local |
|---|---|---|
| Agentes de texto (brief, copy, landing) | Gemini Flash | Ollama `gpt-oss:20b` (solo texto) |
| Dirección creativa | Gemini Pro | — |
| Visión (moodboard, QA) | Gemini Flash | Ollama con modelo de visión (por ejemplo, Qwen2.5-VL 7B o Gemma 3) |
| Key visual | Gemini Image | ComfyUI SDXL / Flux schnell |
| Recorte y upscale | ComfyUI BiRefNet | lib ONNX en Node |
| Embeddings (manual de marca, historial) | Gemini embeddings | Ollama `nomic-embed-text` |

> Los IDs exactos de los modelos van en `.env` y se validan al iniciar (cambian seguido).

## 8. Stack (actualizado)

| Pieza | Elección |
|---|---|
| App | **Next.js 15** (App Router, TS) + Tailwind + shadcn/ui |
| Orquestación | **LangGraph.js** + `PostgresSaver` |
| LLM | `@langchain/google-genai` / `@langchain/ollama` detrás de un `ModelProvider` |
| Imagen | `ImageProvider`: `GeminiImageProvider`, `ComfyUIProvider` |
| **Render de piezas** | **Plantillas HTML/CSS + Playwright (Chromium headless)** → PNG y PDF. *Reemplaza a Satori:* las referencias usan `blur`, degradados radiales, `mix-blend-mode` y tracking, y Satori no soporta bien esos estilos. Además, la landing usa el mismo motor |
| Plantillas | componentes React renderizados a HTML estático (`renderToStaticMarkup`), con tokens como CSS variables |
| DB | **PostgreSQL 16 + pgvector** en contenedor vía **OrbStack** (compatible con `docker compose`), con Drizzle |
| Cola | **pg-boss** (worker aparte; evita timeouts en Next) |
| Archivos | `./storage/{eventId}/...` |
| Tiempo real | SSE para el progreso de cada nodo |
| PDF | Playwright `page.pdf()` + `pdf-lib` para la imposición de credenciales |

### Entorno local (macOS)
- **Contenedores: OrbStack**, no Docker Desktop. OrbStack usa el mismo CLI y el mismo `docker-compose.yml`, así que no cambia nada del proyecto.
- En esta Mac conviven varios contextos de Docker (`colima`, `desktop-linux`, `orbstack`), y hoy el activo es **colima**. Para no depender de eso, los scripts del proyecto fijan el contexto explícitamente: `docker --context orbstack compose up -d` (por ejemplo, `pnpm db:up`).
- OrbStack expone los servicios en `localhost` y también en dominios `*.orb.local` (por ejemplo, `postgres.flock-ai-day.orb.local`). Usamos `localhost:5433` (el 5432 ya está ocupado en esta Mac por un túnel de colima). URL: `postgres://flock:flock@localhost:5433/flock_event_studio`.

## 9. Brand kit de Flock (capa base, inmutable)

Hay dos niveles de identidad:

```
Brand kit Flock  (fijo: logo, colores institucionales, fuentes, reglas)
   └─ Event Kit  (por evento: key visual, paleta del evento, display font, hashtag)
        └─ Piezas
```

- **Dónde vive:** [`brand/`](../brand/) en el repo, con un manifiesto [`brand/brand.json`](../brand/brand.json) que describe cada variante del logo (tipo, color, fondo de uso, tamaño mínimo, área de resguardo). Al iniciar, se carga en la tabla `brand_kit`.
- **Cómo lo usa el sistema:**
  - **Compositor:** elige automáticamente la variante del logo según la luminancia del fondo (blanco sobre oscuro, color sobre claro) y respeta el tamaño mínimo y el área de resguardo.
  - **Creative director:** recibe los colores institucionales y las reglas como restricciones. La paleta del evento puede ampliarlos, pero no reemplazarlos.
  - **Brand QA:** valida por código el contraste del logo, su tamaño mínimo y el área de resguardo.
  - **RAG:** el manual en PDF se indexa en pgvector para que los agentes consulten tono y reglas.
- **Regla dura:** el logo es un archivo, nunca un prompt. **Jamás** se pasa al modelo de imagen para que lo dibuje ni se le aplican efectos. Las plantillas lo insertan como SVG sobre la composición final.
- **Versionado:** si cambia la marca, se actualiza `brand/` y los eventos nuevos usan la versión nueva. Los eventos anteriores guardan la versión con la que se crearon.

## 10. El "Event Kit" (pieza central)

```jsonc
{
  "event": { "name": "AI Day 2026", "date": "2026-10-09", "hashtag": "#FLOCKAIDAY",
             "tagline": "LEARN · EXPERIMENT · EVOLVE TOGETHER" },
  "tokens": {
    "color": { "bg": "#0B0B3B", "bgAlt": "#161616", "accent": "#2B2BFF",
               "glow": ["#3A1CFF", "#B85CFF", "#FF8AD8"], "text": "#FFFFFF" },
    "gradient": { "hero": "radial-gradient(circle at 50% 50%, #1a1aff 0%, #0b0b3b 70%)" },
    "font": { "display": "Unbounded", "body": "Manrope" },   // del catálogo local
    "radius": 16, "stroke": 2
  },
  "keyVisual": {
    "master": "kv_master.png",        // alpha, 4096px
    "crops": ["kv_corner_tr.png", "kv_corner_tr_tight.png"],
    "blurred": ["kv_blur_bl.png", "kv_blur_br.png"]
  },
  "layoutFamily": "corner-hero",       // dónde va el objeto y cómo se apoya
  "copy": { "oneLiner": "...", "description": "..." }
}
```

Todas las plantillas consumen solo esto y los datos. **Cambiar la dirección creativa re-renderiza todo en segundos**, sin volver a llamar a la IA.

## 11. Editor conversacional (iterar las piezas con la IA)

En el producto final, la persona elige una pieza (o varias), escribe en lenguaje natural lo que quiere cambiar ("la flor más chica", "el título en inglés", "probá un violeta más cálido") y la IA propone el cambio. Antes de aplicarlo, la persona decide **a qué afecta**.

### Alcance de cada cambio

| Alcance | Qué significa | Dónde se guarda |
|---|---|---|
| **Todas las piezas** | el cambio pasa a ser parte de la identidad del evento | Event Kit (nueva versión) o contenido compartido |
| **Piezas específicas** | un grupo elegido a mano, o por tipo ("todas las credenciales", "los 3 posteos") | override de grupo |
| **Solo la seleccionada** | ajuste puntual de una pieza | override de pieza |

Cada pieza se resuelve en cascada, como CSS:

```
plantilla (valores por defecto) → Event Kit → overrides de grupo → override de la pieza → datos (agenda, asistente)
```

Lo más específico gana. Si una pieza tiene un ajuste propio y después llega un cambio global sobre la misma propiedad, la pieza conserva su ajuste y la UI lo marca ("esta pieza tiene ajustes propios · restablecer").

### La IA no edita HTML: propone operaciones

El LLM traduce el pedido a un **ChangeSet**: una lista de operaciones tipadas (Zod) sobre las capas de arriba. Así cada cambio es validable, previsualizable, reversible y nunca rompe la marca.

| Operación | Capa natural | Ejemplos de pedido |
|---|---|---|
| `setToken` (color, fuente, radio, trazo) | Event Kit | "más violeta", "otra tipografía para los títulos" |
| `setCopy` (campo de texto) | contenido | "título más corto", "pasalo a inglés", "más formal" |
| `setLayout` (posición/escala del key visual, alineación, tamaño de texto, densidad) | parámetros de plantilla | "la flor más chica", "el nombre más grande" |
| `toggleElement` (hashtag, tagline, fecha, desenfoques) | parámetros de plantilla | "sacá el hashtag de las credenciales" |
| `setBackground` (variante: oscuro, degradado, institucional) | Event Kit u override | "este con fondo negro" |
| `regenerateKeyVisual` (ajuste de prompt) | Event Kit | "que la flor sea más naranja" (requiere el modelo de imagen de la fase 4) |
| `setData` (registro de agenda o asistente) | datos | "el apellido de Juan va con tilde" |

Si un pedido no entra en ninguna operación, la IA lo dice, no improvisa, y el pedido queda registrado como sugerencia de función.

**Alcance sugerido por defecto** (la persona siempre puede cambiarlo):
- Estilo (`setToken`, `setBackground`, `regenerateKeyVisual`) → **todas**, para mantener la coherencia. Si se elige otro alcance, la IA avisa que esa pieza va a quedar distinta del resto.
- Texto (`setCopy`) y diseño (`setLayout`, `toggleElement`) → **solo la seleccionada**, o el grupo si el pedido lo nombra ("en todas las credenciales…").
- Datos (`setData`) → siempre en **todas las piezas que usan ese dato**: un nombre corregido se corrige en la credencial y en el certificado.

### Flujo (sub-grafo `edit` en LangGraph)

```
mensaje + pieza(s) seleccionada(s)
   │
   ▼
1. interpret   LLM con visión: captura de la pieza + su estado resuelto + Event Kit + reglas de marca
               → ChangeSet { operaciones, alcance sugerido, explicación, preguntas? }
   │
   ▼
2. guard       código: reglas de marca (el logo es intocable), contraste WCAG AA de los colores nuevos,
               que los textos entren (data-fit), idiomas
   │
   ▼
3. preview     re-render rápido (escala 0,5) solo de las piezas afectadas → antes / después
   │
   ▼
⏸ la persona elige el alcance [Todas · Específicas · Solo esta], ajusta o responde
   │
   ▼
4. apply       guarda la versión, re-renderiza las piezas afectadas en calidad final, corre el QA de diseño
               (impeccable detect + contraste) y actualiza la galería
```

Cada cambio aplicado es una **versión**: se puede deshacer, comparar con la anterior o volver a cualquier punto. La conversación queda guardada por evento.

### Pantalla "Estudio" (reemplaza a la galería de piezas)

- **Izquierda:** piezas agrupadas por tipo, con selección múltiple y filtros. Una marca indica qué piezas tienen ajustes propios.
- **Centro:** la pieza seleccionada grande, con un interruptor antes/después.
- **Derecha:** el chat. Cada propuesta de la IA muestra:
  - qué entendió, en chips concretos ("Acento → `#B85CFF`", "Key visual −20%");
  - el **selector de alcance** con la cantidad de piezas afectadas, por ejemplo `Todas (42) · Específicas (3) · Solo esta`;
  - una tira con miniaturas de las piezas afectadas;
  - **Aplicar** y **Descartar**.
- Las piezas se pueden nombrar en el chat con `@` (`@credenciales`, `@post-agenda`) para fijar el alcance desde el mensaje.

### Qué cambia en lo que ya está construido

- **Plantillas parametrizables (prerrequisito).** Hoy las posiciones y tamaños están fijos en cada plantilla. Hay que extraerlos a un objeto `LayoutParams` por plantilla, con valores por defecto, rangos válidos y elementos opcionales. Esa es la superficie que la IA puede tocar; lo que no está ahí no se puede editar por chat.
- **Render incremental.** Re-renderizar solo las piezas afectadas, y las previews a media escala, para que la respuesta tarde segundos.
- **Pieza = registro en la base.** Cada archivo de `storage/` pasa a ser una fila de `pieces` con su estado resuelto, para saber qué piezas afecta cada cambio.

### Modelos
- `interpret`: Gemini Flash con visión y salida estructurada (Zod). Alternativa local: Qwen2.5-VL 7B en Ollama.
- `regenerateKeyVisual`: el mismo proveedor de imagen de la exploración de identidad.


## 12. Modelo de datos (actualizado)

- `brand_kit` (Flock, único) y `font_catalog` (fuentes locales con licencia + metadata de vibe).
- `events`: brief y estado (`exploring | kit_locked | producing | done`).
- `moodboard_images`: archivo, origen y análisis (`StyleProfile` parcial).
- `creative_directions`: concepto, tokens, prompts, `locked_fields[]`, `parent_id` (para el historial de iteraciones) y estado.
- `key_visuals`: imagen, máscara, prompt, proveedor, seed y `direction_id`.
- `event_kits`: JSON del Event Kit y versión.
- `agenda_items`, `attendees`: datos para las piezas por lote.
- `pieces`: tipo, plantilla, datos, archivo, versión, QA y estado.
- `feedback`: sobre dirección o pieza.
- `chat_messages`: conversación del editor por evento (rol, texto, piezas en contexto, `change_set_id`).
- `change_sets`: pedido original, operaciones (JSON), alcance (`all | group | piece`), piezas destino, estado (`proposed | applied | discarded | reverted`) y versión del kit antes/después.
- `piece_overrides`: operaciones que aplican a una pieza o a un grupo (selector por tipo o lista de ids), ligadas al `change_set` que las creó.
- `runs`, `run_steps`: trazabilidad, tokens y costo estimado.
- `brand_chunks(embedding)`: manual de marca y **eventos anteriores** como referencia (RAG).

## 13. Pantallas

1. **Eventos**: lista de eventos y botón para crear uno nuevo (o duplicar uno anterior).
2. **Brief + moodboard**: formulario guiado y zona para soltar imágenes. Muestra en vivo la paleta extraída.
3. **Direcciones creativas**: 3 tarjetas grandes con key visual y previews. En cada una: 👍 elegir, 🔒 bloquear elemento, 💬 feedback, ↻ regenerar, "mezclar con…". Historial de rondas.
4. **Event Kit**: ajuste fino manual (colores, fuente, hashtag, posición del objeto) con preview en vivo.
5. **Datos**: tabla editable de la agenda e import de CSV de flockers.
6. **Estudio**: galería de piezas + vista grande + chat para editarlas en lenguaje natural, con alcance por cambio (todas / específicas / la seleccionada), versiones y estado de QA (ver §11).
7. **Exportar**: ZIP, link a la landing local y PDF de credenciales.

## 14. Estructura del repo

```
flock-ai-day/
├─ docker-compose.yml          # postgres+pgvector (se levanta con OrbStack)
├─ apps/web/                   # Next.js
├─ apps/worker/                # pg-boss + LangGraph + Playwright
├─ packages/agents/            # grafos, nodos, prompts, schemas Zod
├─ packages/templates/         # plantillas React→HTML por output + layout families
├─ packages/renderer/          # Playwright: HTML→PNG/PDF, imposición
├─ packages/providers/         # Gemini, Ollama, ComfyUI
├─ packages/db/                # Drizzle
├─ comfy/workflows/            # workflows ComfyUI (formato API)
├─ brand/                      # logo, fuentes, manual Flock
├─ references/                 # piezas de eventos anteriores (moodboards de ejemplo)
└─ storage/                    # outputs (gitignored)
```

## 15. Roadmap

| Fase | Alcance | Demo al final |
|---|---|---|
| **0. Base** | monorepo, docker-compose (OrbStack), Drizzle, brand kit, catálogo de fuentes | app vacía corriendo |
| **1. Plantillas + Event Kit manual** | renderer Playwright; plantillas del cronograma, post de LinkedIn, credencial y landing; **reproducir el AI Day 2026** con un Event Kit escrito a mano y el objeto recortado de las referencias | piezas idénticas en estilo a las de BrandBox, sin IA → valida el motor |
| **2. Producción con IA** | copywriters (LinkedIn, landing), agenda y CSV de credenciales, galería y review | kit completo desde un Event Kit fijo |
| **3. Editor conversacional** | plantillas parametrizables (`LayoutParams`), cascada de overrides, sub-grafo `edit` (interpret → guard → preview → apply), pantalla Estudio, versiones y deshacer | "la flor más chica en todas las credenciales" se aplica en segundos |
| **4. Exploración de identidad** | moodboard analyst, creative director, Gemini Image, recorte ComfyUI, 3 direcciones, bloquear y mezclar | de temática + moodboard a identidad nueva |
| **5. QA + memoria** | brand QA, RAG con eventos anteriores, costos | calidad consistente |
| **6. Offline y extras** | workflows ComfyUI de key visual, Ollama, certificados, fondos de Teams | modo 100% local |

### Estado (2026-10-09)
- ✅ **Fase 0**: monorepo, Postgres en OrbStack, esquema Drizzle (15 tablas), seed del brand kit, página de brand kit.
- ✅ **Fase 1**: `packages/templates` (React → HTML con tokens del Event Kit) + `packages/renderer` (Playwright → PNG/PDF). `pnpm render:event ai-day-2026` genera 42 piezas en ~13 s: 7 slides de cronograma + resumen, 3 posteos de LinkedIn × 2 formatos + texto, 10 credenciales + PDF A4 3×3 con marcas de corte, 10 certificados y la landing autocontenida. Galería en `/eventos/ai-day-2026`.

**Aprendizajes de la fase 1:**
- El key visual recortado de la referencia viene **cortado en el borde superior**: solo se puede usar anclado arriba y sin rotar. En la fase 4, el generador tiene que producir el **objeto completo** (sin cortes) y en alta resolución (≥ 3000 px). El master actual es de 1072 px, agrandado 2× desde la referencia.
- El ajuste automático de texto (`data-fit`) es imprescindible: nombres largos y títulos variables. Las fuentes display sobresalen ~10% de su caja; el control de alto lo tiene en cuenta.
- Las fuentes son alternativas OFL (Unbounded + Manrope) hasta tener las de BrandBox.

> **Por qué la fase 1 va sin IA:** si podemos replicar las piezas del AI Day 2026 con plantillas, el resto es "solo" generar Event Kits nuevos. Es el mayor riesgo técnico y conviene validarlo primero.

## 15b. Pendiente: sección de credenciales

El formulario de creación ya no pide la lista de asistentes (decisión del 2026-10-09: no hace falta para definir el evento). Las credenciales y certificados personalizados pasan a una **sección propia del evento**, con dos formas de cargar los nombres:

- **Hoy:** nómina de ejemplo con nombres ficticios (`data/nomina-ejemplo.csv`), avisada en la página del evento.
- **Carga manual:** quien organiza pega o sube la lista (CSV) o la edita en una tabla.
- **Conectada a la nómina (objetivo):** un **Excel en SharePoint** leído con Microsoft Graph en cada generación, así cada evento nuevo trae a los flockers vigentes. Cada evento guarda un snapshot, para que sus piezas no cambien después.

Ya está implementada la interfaz `RosterSource` (`mock | csv | sharepoint-excel`) en `packages/studio/src/roster.ts`. Falta el conector a Graph, que requiere una app registrada por IT. Detalle en [informes/07](informes/07-nomina-y-credenciales.md).

## 16. Decisiones abiertas

1. **Assets de marca:** ¿logo Flock en SVG y nombres o archivos de las fuentes que usó BrandBox? (la display parece una *extended* tipo Unbounded o Monument Extended; hay que confirmar la licencia).
2. **Credenciales:** ¿tamaño de impresión (CR80 85×54 mm, A6, colgante vertical)? ¿llevan foto o QR?
3. **LinkedIn:** ¿se publica desde la página de Flock o desde perfiles personales? Cambia el tono y el formato (1200×627 o 1080×1350).
4. **Landing:** ¿solo informativa, o con un formulario de inscripción (por ejemplo, a un Google Form)?
5. **Gemini:** ¿hay una API key corporativa? ¿alguna restricción para subir imágenes del moodboard a una API externa?
6. **Usuarios:** ¿lo usa una sola persona en su Mac, o varias de People Experience? Define si hace falta auth o un servidor local compartido.

---

### Cambios respecto de v0.1
- El flujo ahora es **identidad → piezas**, con exploración de 3 direcciones y bloqueo/mezcla.
- Nuevo input: **moodboard**. Nuevos inputs de datos: **agenda** y **CSV de flockers**.
- Outputs redefinidos: LinkedIn, landing HTML, cronograma y credenciales.
- Render con **Playwright (HTML/CSS)** en lugar de Satori.
- Análisis de ComfyUI y modelos según el hardware real; ComfyUI entra en el MVP para el recorte.
- El roadmap empieza reproduciendo el AI Day 2026 sin IA.
