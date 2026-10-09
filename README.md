# Flock Creative Studio

Orquestador local de agentes para generar la identidad y las piezas gráficas de los eventos de Flock IT.
Ver la propuesta técnica en [docs/PROPUESTA_TECNICA.md](docs/PROPUESTA_TECNICA.md).

## Requisitos

- Node 24+
- pnpm (vía corepack: `corepack enable` una sola vez)
- [OrbStack](https://orbstack.dev) para Postgres
- Chromium de Playwright: `pnpm --filter @flock/renderer exec playwright install chromium`

## Primeros pasos

```bash
cp .env.example .env      # completar GOOGLE_API_KEY cuando haga falta
pnpm install
pnpm bootstrap            # levanta Postgres, aplica migraciones y carga el brand kit
pnpm dev                  # compila las plantillas y levanta la app en http://localhost:3000
```

## Assets que no están en el repo

El repo es público, así que algunos archivos quedan solo en la máquina local (ver `.gitignore`):

- `references/`: piezas de eventos anteriores hechas por la agencia y material interno, usadas como referencia.
- `events/*/assets/`: imágenes propias de eventos de ejemplo (por ejemplo, el key visual del AI Day 2026).
- `brand/elements/cover-raw-*.png`: fondo de la portada interna de Flock.

La app y la CLI funcionan sin ellos: el evento de ejemplo se genera sin imagen propia y la página de marca muestra solo los elementos disponibles.

## Qué se puede hacer

- **Eventos:** definir un evento (datos, estilo, agenda) y generar la familia completa de piezas.
- **Estilos:** armar una biblioteca de estilos del equipo a partir de piezas de referencia, ver cómo se aplican y borrarlos.
- **Referencia gráfica:** subir una imagen y que el sistema lea su esencia (Claude o Gemini con visión, con un crítico que la ajusta) para proponer un estilo.
- **Key visual:** generar un objeto original inspirado en la referencia (ComfyUI local o Gemini).
- **Editor conversacional:** el botón "chat" de cada pieza abre el chat sobre esa pieza; los cambios se aplican a todas, a su grupo o solo a esa, y se pueden deshacer.
- **LinkedIn y Slack por momentos:** piezas para antes, durante y después del evento; programación de publicaciones (Slack listo para conectar, mientras tanto publicación manual: ver [docs/integraciones/slack.md](docs/integraciones/slack.md)).
- **Calendario:** todas las publicaciones de los eventos, programadas y sugeridas, por mes.
- **Credenciales:** cargar la nómina (Excel de Forms tal como sale, CSV o link de SharePoint); credencial impresa solo para quien va presencial; descarga en .zip.
- **Piezas opcionales:** cada evento elige qué genera (los certificados vienen apagados) y se suman o se sacan después.
- **Control de calidad:** textos recortados corregidos solos y verificador de lectura con visión en cada generación.
- **Métricas:** uso, costo, tiempo ahorrado, modelos y evals.

## Arquitectura

```
                 ┌──────────────── apps/web (Next.js) ────────────────┐
  persona ──────▶│ evento · estilo · chat por pieza · calendario ·    │
                 │ métricas · nómina · Slack (manual hasta conectar)  │
                 └──────┬──────────────────────┬──────────────────────┘
                        │                      │ telemetría (usage_events, llm_calls)
          packages/studio (orquesta)           ▼
   ┌────────────┬──────────┴───────┬─────────────────┐     PostgreSQL + pgvector
   │ agents     │ templates        │ renderer        │     (local, OrbStack)
   │ (LLM)      │ (código)         │ (Playwright)    │
   └────────────┴──────────────────┴─────────────────┘
```

| Agente | Modelo (cadena con respaldo) | Qué hace | Prompt |
|---|---|---|---|
| Redactor | Claude Sonnet 5.5 → Haiku 5.5 → Gemini | Textos por momento (LinkedIn, Slack, landing) | `copy` |
| Lector de referencias | Claude con visión → Gemini | Traduce una imagen al vocabulario cerrado del sistema | `reference` |
| Crítico de fidelidad | Claude con visión | Compara una pieza de prueba con la referencia y con el AI Day; ajusta | `critic` |
| Editor | Claude | Pedido en lenguaje natural → operaciones tipadas, con alcance | `editor` |
| Verificador de lectura | Claude con visión | Confirma horarios, títulos y nombres completos en las piezas | `verifier` |
| Ilustrador | Gemini Image → ComfyUI (SDXL local) | Key visual y elementos en la técnica de la referencia | `keyvisual`, `elements` |

Lo visual (paletas, composiciones, fuentes, formas, plantillas) es **código con semilla**: reproducible, sin costo y editable por parámetros. Los modelos leen, escriben, critican y verifican; no dibujan las piezas. Los prompts están versionados en `packages/agents/prompts/` y cada llamada registra cuál usó.

## Impacto medido

Cada generación registra su tiempo de máquina, su costo de IA y el trabajo manual equivalente según una [línea base](docs/metricas-y-evals.md#tiempo-ahorrado). Por ejemplo, Hack Night 2026 (34 piezas: LinkedIn, Slack, cronograma, 12 credenciales, landing):

| | Manual (línea base) | Flock Creative Studio |
|---|---|---|
| Tiempo | ~15 h de diseño + días de espera de agencia | 14 s |
| Costo de IA | — | ~US$ 0,06 (estimado) |
| Control de calidad | a ojo | geométrico en todas las piezas + verificador con visión + Impeccable |

La línea base y los precios son estimaciones iniciales a validar: ver [docs/metricas-y-evals.md](docs/metricas-y-evals.md).

## Calidad, métricas y evals

- **Métricas** (página en la app): uso, tiempos, costo, tiempo ahorrado, modelos (latencia, tokens, respaldos, versión de prompt) y evals.
- **Tests:** `pnpm test` (Vitest).
- **Evals:** `pnpm evals` sobre casos fijos, guardadas en la base y en [docs/evals/resultados.md](docs/evals/resultados.md).
- **CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) corre tipos, lint, migraciones, tests y evals.

Todo el detalle está en [docs/metricas-y-evals.md](docs/metricas-y-evals.md).

## Generación de key visuals con ComfyUI

El proveedor principal es **Gemini Image** (requiere facturación activa en el proyecto de Google Cloud). Si no está disponible, se usa **ComfyUI local** con SDXL: ver [comfy/README.md](comfy/README.md).

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm test` | Tests (Vitest) |
| `pnpm evals [--suite copy,editor,reference,verifier,design]` | Evals sobre casos fijos; guarda en la base y en `docs/evals/resultados.md` |
| `pnpm prompts:lock` | Actualiza el hash de los prompts después de cambiar uno (y subir su versión) |
| `pnpm diversity --label X --ref nombre=ruta [--critic]` | Hoja de contactos para medir la diversidad de lo que se genera (ver docs/informes/14) |
| `pnpm db:up` / `db:down` | Levanta / baja Postgres + pgvector en OrbStack (puerto **5433**) |
| `pnpm db:generate` | Genera una migración a partir de `packages/db/src/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones |
| `pnpm db:seed` | Carga `brand/brand.json` como nueva versión del brand kit (si cambió) |
| `pnpm db:studio` | Drizzle Studio para explorar la base |
| `pnpm render:event <slug> [--style …] [--seed N] [--copy gemini]` | Genera una familia desde `events/<slug>/` sin pasar por la app (ver galería en `/eventos/<slug>`) |

## Diseño: Impeccable

El proyecto usa la skill [Impeccable](https://impeccable.style) (Apache-2.0), instalada en `.claude/skills/impeccable` y fijada en `skills-lock.json`.

- `PRODUCT.md` (raíz): verdad del producto que lee la skill antes de cualquier trabajo de diseño.
- `pnpm render:event` corre `impeccable detect` sobre una pieza de cada plantilla y deja el reporte en `storage/<slug>/qa/report.txt`.
- En Claude Code: `/impeccable critique apps/web`, `/impeccable polish packages/templates`, etc.

## Estructura

```
apps/web/          Next.js 16 (UI + API)
packages/db/       Esquema Drizzle, migraciones y seed
packages/templates/ Estilos, paletas, visuales generativos y plantillas (JSX → HTML, sin React)
packages/agents/   Agentes con LLM (textos, lectura, crítico, editor, verificador, imágenes) y su telemetría
  prompts/         Prompts versionados (.md con id y versión) + prompts.lock.json
packages/studio/   Generación de la familia completa, nómina y parsers
packages/renderer/ Playwright: HTML → PNG / PDF
tools/             Scripts: render de eventos, recorte de key visual, hoja de diversidad, bloqueo de prompts
  evals/           Evals (pnpm evals) y sus casos fijos
events/<slug>/     Eventos de ejemplo para la CLI (event.json, content.json, agenda.csv, attendees.csv)
data/              Nómina de ejemplo (nombres ficticios)
brand/             Brand kit de Flock (logos, colores, reglas) — fuente de verdad
references/        Piezas de eventos anteriores
docs/              Propuesta técnica, informes por etapa, métricas y evals, integraciones
.github/workflows/ CI: tipos, lint, tests, migraciones y evals
```
