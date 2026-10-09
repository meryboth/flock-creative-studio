# 02 · Base local: datos y marca

**Fecha:** 2026-10-09

## Qué se hizo

- **Monorepo con pnpm workspaces** (vía `corepack`, sin instalaciones globales).
- **PostgreSQL 16 + pgvector** en contenedor con **OrbStack** (en esta Mac Docker Desktop no anda bien). Puerto **5433**, porque el 5432 lo ocupaba un túnel de colima. Los scripts fijan `--context orbstack` para no depender del contexto activo.
- **Drizzle ORM** con 15 tablas: brand kit, eventos, moodboard, direcciones creativas, key visuals, Event Kits, agenda, asistentes, piezas, feedback, runs y chunks para RAG con índice HNSW.
- **Brand kit como fuente de verdad** en `brand/`: logos en SVG (horizontal color, blanco y negro; isotipo en contorno), colores institucionales, elementos gráficos y reglas, descritos en `brand/brand.json`. El seed crea una versión nueva solo si el manifiesto cambió.

## Decisiones

- **Postgres y no SQLite:** un solo motor para datos, checkpoints de LangGraph y búsqueda vectorial (manual de marca, eventos anteriores).
- **El logo es un archivo, nunca un prompt.** Ningún modelo lo genera ni lo modifica; las plantillas lo insertan como SVG y eligen la variante por el esquema del fondo.
- **Dos capas de identidad:** la marca Flock es fija; cada evento tiene su propia paleta e identidad. El AI Day 2026, por ejemplo, no usó los colores institucionales.

## Contratiempos

- Figma: el conector estaba autenticado con una cuenta personal sin acceso al archivo de la organización. Se resolvió duplicando el archivo y, al final, filtrando los assets a mano.
- `pnpm setup` es un comando propio de pnpm: el script del proyecto se renombró a `pnpm bootstrap`.
