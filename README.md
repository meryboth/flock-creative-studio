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
- **Referencia gráfica:** subir una imagen y que el sistema lea su esencia (Gemini con visión) para proponer un estilo.
- **Key visual:** generar un objeto original inspirado en la referencia (ComfyUI local o Gemini).

## Generación de key visuals con ComfyUI

Ver [comfy/README.md](comfy/README.md). Requiere Comfy Desktop abierto y el modelo SDXL base en `~/ComfyUI-Shared/models/checkpoints`. Si ComfyUI no está disponible, se intenta con Gemini (requiere facturación activa).

## Scripts

| Script | Qué hace |
|---|---|
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
packages/agents/   Textos con Gemini y análisis de moodboard
packages/studio/   Generación de la familia completa, nómina y parsers
packages/renderer/ Playwright: HTML → PNG / PDF
tools/             Scripts: render de eventos, recorte de key visual (cutout.ts)
events/<slug>/     Eventos de ejemplo para la CLI (event.json, content.json, agenda.csv, attendees.csv)
data/              Nómina de ejemplo (nombres ficticios)
brand/             Brand kit de Flock (logos, colores, reglas) — fuente de verdad
references/        Piezas de eventos anteriores
docs/              Propuesta técnica
```
