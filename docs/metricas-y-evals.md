# Métricas, trazabilidad y evals

Cómo se mide Flock Creative Studio: qué se usa, cuánto tarda, cuánto cuesta, cuánto tiempo ahorra y qué tan bien funcionan los agentes. Todo queda en la base local (PostgreSQL) y se ve en la página **Métricas** de la app.

> Sin datos personales: la telemetría guarda ids, cantidades y parámetros, nunca nombres ni correos de la nómina.

## Esquema

```
events ─┬─< runs ─┬─< run_steps            (pasos de cada generación con su duración)
        │         └─< llm_calls             (cada llamada a un modelo de esa corrida)
        ├─< usage_events                     (cada acción de una persona o del sistema)
        └─< llm_calls                        (también las que no son de una corrida: chat, lectura)

eval_runs ─< eval_results                    (corridas de evals y el resultado de cada caso)
```

| Tabla | Una fila por… | Columnas clave |
|---|---|---|
| `usage_events` | acción (ver taxonomía) | `kind`, `actor`, `event_id`, `run_id`, `ok`, `duration_ms`, `props` (JSON) |
| `llm_calls` | llamada a un modelo, incluidos los intentos fallidos y los respaldos | `task`, `provider`, `model`, `attempt` (1 = primer modelo; >1 = respaldo), `ok`, `latency_ms`, `input_tokens`, `output_tokens`, `cost_usd`, `prompt_id`, `prompt_version`, `event_id`, `run_id` |
| `runs` | generación de una familia | `status`, `cost_usd` (suma de sus `llm_calls`), `manual_minutes` (línea base), `machine_seconds` |
| `run_steps` | paso de una corrida | `node` (`copy`, `render`), `duration_ms`, `output` |
| `pieces` | pieza generada | `qa_score` (1 = sin problemas), `qa_report` (control geométrico y de lectura) |
| `eval_runs` | corrida de una suite de evals | `suite`, `git_sha`, `config` (proveedores y modelos), `cases`, `passed`, `score` |
| `eval_results` | caso de una corrida | `case_id`, `score`, `passed`, `metrics` (cada chequeo), `notes`, `latency_ms` |

Definición: [`packages/db/src/schema.ts`](../packages/db/src/schema.ts), sección "Telemetría".

### Cómo se registra

- **Llamadas a modelos:** `invokeStructured` (`packages/agents/src/llm.ts`) informa cada intento a un observador. La app lo conecta a `llm_calls` en [`apps/web/src/lib/telemetry.ts`](../apps/web/src/lib/telemetry.ts). Los tokens salen de la respuesta cruda del modelo (`includeRaw`). Las imágenes (key visual, elementos) se registran desde la ruta que las genera.
- **Contexto:** un `AsyncLocalStorage` lleva el evento y la corrida. Todo lo que pasa dentro de una generación (textos, verificador) queda asociado sin pasar ids a mano.
- **Acciones:** `track(kind, …)` en cada punto del flujo. Nunca bloquea ni rompe el flujo si la base falla.

### Taxonomía de `usage_events.kind`

| kind | Cuándo | props |
|---|---|---|
| `event.created` | se crea un evento | estilo, si viene de biblioteca o referencia, gráficos IA, piezas elegidas, cantidad de bloques y asistentes, idioma |
| `generation.started` / `generation.finished` / `generation.failed` | generación de la familia | piezas, verificadas, para revisar, ajustadas solas, problemas de lectura, costo, minutos manuales, segundos de máquina, composición |
| `variant.requested`, `copy.rewritten` | "Otra variante", "Reescribir textos" | semilla |
| `change.proposed` / `change.applied` / `change.discarded` / `change.undone` | chat de edición | operaciones, alcance sugerido y elegido, grupo de la pieza |
| `post.scheduled` / `post.published` / `post.cancelled` | publicaciones de Slack y LinkedIn | canal, momento, si Slack está conectado, `via` (app o manual), minutos de atraso |
| `roster.loaded` | carga de la nómina | fuente, confirmados, presenciales |
| `outputs.changed` | piezas del evento | grupos |
| `reference.analyzed` | lectura de una referencia | modelo, técnica, composición, fuente, notas del crítico |
| `graphics.generated` | key visual y elementos con IA | proveedor, elementos, errores |
| `download.zip` | descarga | grupo, archivos |
| `style.created` / `style.deleted` | biblioteca de estilos | id, composición |

### Consultas útiles

```sql
-- Costo y tiempo por generación en los últimos 30 días
select created_at, cost_usd, manual_minutes, machine_seconds from runs
where status = 'done' and created_at > now() - interval '30 days' order by created_at desc;

-- Uso de respaldos: cuántas llamadas no resolvió el primer modelo
select task, count(*) filter (where attempt > 1 and ok) * 100.0 / count(*) filter (where ok) as pct_respaldo
from llm_calls group by task;

-- Tasa de aceptación del chat
select count(*) filter (where kind = 'change.applied') * 100.0 / nullif(count(*) filter (where kind = 'change.proposed'), 0)
from usage_events;

-- Qué versión de cada prompt se usó y con qué resultado
select prompt_id, prompt_version, count(*), avg(latency_ms), sum(cost_usd) from llm_calls group by 1, 2 order by 1, 2;
```

## Costo

Cada llamada guarda su costo estimado (`llm_calls.cost_usd`) con la tabla de [`packages/agents/src/pricing.ts`](../packages/agents/src/pricing.ts):

- texto y visión: USD por millón de tokens de entrada y de salida;
- imágenes: USD por imagen;
- ComfyUI: 0, porque corre local.

Al terminar una generación se suma el costo de sus llamadas en `runs.cost_usd`. La página del evento lo muestra junto al tiempo, y Métricas lo muestra en total, por familia y por modelo.

> ⚠ Los precios de la tabla son **de referencia, no verificados**. Antes de usar los números para decidir, revisalos contra las páginas de precios de Anthropic y Google y ajustalos con `MODEL_PRICES` en el `.env` (JSON con el mismo formato).

Ejemplo medido (Hack Night 2026, 34 piezas): la generación cuesta unos **US$ 0,06**. Casi todo es el verificador de lectura (7 piezas leídas con visión, unos 2.000 tokens cada una), y los textos suman unos centavos más cuando se redactan.

## Tiempo ahorrado

Cada generación compara el **tiempo de máquina** con una **línea base del trabajo manual**: cuánto le lleva a una persona de diseño hacer esas piezas a mano. Está en [`packages/studio/src/baseline.ts`](../packages/studio/src/baseline.ts):

| Pieza | Minutos |
|---|---|
| Armado de la familia (brief, estilo, sistema), una vez | 120 |
| Imagen de posteo (cada formato) | 40 |
| Texto de posteo | 20 |
| Imagen / texto de Slack | 20 / 10 |
| Slide del cronograma / resumen | 15 / 30 |
| Credencial (por persona) / hoja para imprimir | 4 / 20 |
| Certificado (por persona) | 3 |
| Landing | 240 |
| Espera de agencia (días hábiles) | 4 |

> ⚠ Son valores **iniciales para validar con Marketing y People**. Se ajustan sin tocar código con `BASELINE_MINUTES` en el `.env`.

Ejemplo medido (Hack Night 2026: 6 imágenes y 3 textos de LinkedIn, 3 de Slack, 3 slides y resumen, 12 credenciales y 2 hojas, landing): **~15 h de diseño manual contra 14 s de máquina**, sin contar los días de espera de una agencia. La página del evento lo muestra en cada generación y Métricas lo acumula.

## Calidad en cada generación

Antes de mostrar las piezas, cada generación pasa por un control de calidad:

1. **Geométrico** (todas las piezas): en el navegador se mide si algún texto queda recortado por su caja o por un contenedor, o se sale del lienzo. Si pasa, la pieza se vuelve a generar sola con el título más chico (hasta dos veces).
2. **Verificador de lectura** (una muestra: todas las slides del cronograma, el resumen, un posteo, un Slack, la credencial con el nombre más largo y un certificado): un modelo con visión lee la pieza y confirma que horarios, títulos, nombres y fecha están completos y son los correctos.
3. **Detector de Impeccable** (una pieza por plantilla).

Lo que queda pendiente se marca "revisar" en la galería, con el detalle.

## Prompts versionados

Los prompts viven fuera del código, en [`packages/agents/prompts/`](../packages/agents/prompts/): un `.md` por prompt, con frontmatter (`id`, `version`, `description`) y variables `{{así}}`. Las frases por técnica de las imágenes están en `imagenes.json`.

| id | Uso |
|---|---|
| `copy` | Textos del evento (LinkedIn, Slack, landing) |
| `editor` | Chat de edición |
| `reference` | Lectura de referencias con visión |
| `critic` | Crítico de fidelidad |
| `verifier` | Verificador de lectura |
| `keyvisual`, `keyvisual-referencia`, `elements` | Imágenes con IA |

- Cada llamada registra `prompt_id` y `prompt_version` en `llm_calls`, así se puede comparar el rendimiento entre versiones.
- [`prompts.lock.json`](../packages/agents/prompts/prompts.lock.json) guarda el hash de cada versión. **Para cambiar un prompt:** editar el archivo, subir `version` y correr `pnpm prompts:lock`. Si el texto cambia sin subir la versión, `pnpm test` falla.

## Tests

`pnpm test` (Vitest) corre 36 pruebas:

- nómina desde Forms;
- cascada de cambios del chat y contraste al cambiar el fondo;
- variantes y fuentes (que todas tengan ñ y tildes);
- prompts contra el lock;
- validación de lo que propone el crítico;
- reconciliación del verificador;
- costos;
- detección de textos recortados en el navegador.

## Evals

`pnpm evals [--suite copy,editor,reference,verifier,design]` corre casos fijos ([`tools/evals/`](../tools/evals/)), guarda cada corrida en `eval_runs` / `eval_results` y escribe [`docs/evals/resultados.md`](evals/resultados.md) con la última corrida de cada suite.

| Suite | Qué mide | Casos |
|---|---|---|
| `copy` | Textos: momentos, hashtag, largos, voseo, emojis y que no invente números | 3 eventos (con y sin agenda, en español y en inglés) |
| `editor` | Chat: propone exactamente lo pedido, respeta el logo, no inventa operaciones | 15 pedidos |
| `reference` | Ida y vuelta: se renderiza un estilo conocido, se lee como referencia y se compara (composición, esquema, tipo de letra, color, caja) | 7 estilos |
| `verifier` | El verificador marca piezas rotas a propósito y deja pasar las sanas | 5 piezas |
| `design` | Sin modelos: ningún texto recortado, Impeccable sin hallazgos, diversidad visual entre variantes | 12 variantes + detector + diversidad |

Última corrida (Claude Sonnet 5.5): textos 100, chat 100, referencias 97, verificador 100, diseño 100.

## Integración continua

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml), en cada push a `main` y en cada pull request:

1. Tipos de todos los paquetes y lint de la app.
2. Migraciones sobre un Postgres con pgvector.
3. Tests.
4. Evals de diseño (sin modelos).
5. Evals con modelos, solo si el repo tiene el secreto `ANTHROPIC_API_KEY` o `GOOGLE_API_KEY`.

El reporte de evals queda como artefacto de cada corrida.
