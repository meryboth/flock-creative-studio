# 16 · Calidad, trazabilidad, costo y evals

**Fecha:** 2026-10-09

## Por qué

Aparecieron horarios cortados en las piezas ("19:0") que nadie vio a tiempo. A la vez, una revisión del proyecto marcó lo que faltaba para pasar de prototipo a herramienta confiable:

- medir el consumo de tokens y el costo;
- trazabilidad y observabilidad;
- prompts versionados fuera del código;
- tests y evals automáticos;
- evidencia del impacto (tiempo ahorrado).

La evaluación era la dimensión más baja (60).

## Qué se hizo

### Agente de control de calidad

1. **Control geométrico** en todas las piezas. Al renderizar se mide si un texto queda recortado por su caja o por un contenedor (el caso de la hora que no entraba en su bloque de color) o se sale del lienzo. Si pasa, se corrige solo achicando el título, hasta dos veces.
2. **Verificador de lectura** con visión sobre una muestra. Confirma horarios, títulos, nombres y fecha contra los datos reales. Detectó "19:0" y "22:3" en las piezas viejas en unos 3 s por pieza.
3. Lo pendiente queda marcado "revisar" en la galería, con el detalle.

### Trazabilidad

| Qué | Dónde |
|---|---|
| Acciones de las personas y del sistema | `usage_events` (taxonomía en [../metricas-y-evals.md](../metricas-y-evals.md)) |
| Cada llamada a un modelo, con tokens, latencia, respaldo, costo y versión del prompt | `llm_calls` |
| Pasos de cada generación | `run_steps` |

- El contexto (evento y corrida) viaja solo, con `AsyncLocalStorage`.
- La página **Métricas** muestra uso, tiempos, costo, tiempo ahorrado, modelos, evals y últimas acciones.

### Costo y tiempo ahorrado

- **Costo:** se estima por llamada con una tabla de precios ajustable y se suma por corrida.
- **Tiempo ahorrado:** cada generación compara su tiempo de máquina con una línea base del trabajo manual por tipo de pieza.
- **Ejemplo medido** (Hack Night 2026, 34 piezas): ~15 h de diseño manual contra 14 s de máquina, con un costo de IA de ~US$ 0,06.
- Los precios y la línea base son estimaciones iniciales a validar.

### Prompts versionados

- Los 8 prompts (textos, chat, lectura de referencias, crítico, verificador, key visual, key visual con referencias, elementos) y las frases por técnica de las imágenes pasaron a `packages/agents/prompts/`, con id y versión.
- Cada llamada registra qué versión usó.
- `prompts.lock.json` guarda el hash de cada versión, y un test falla si un prompt cambia sin subirla.

### Tests, evals y CI

- **Vitest** (`pnpm test`), 36 pruebas: nómina desde Forms, cascada del chat y contraste, variantes y fuentes, prompts contra el lock, validación del crítico, reconciliación del verificador, costos y detección de textos recortados en el navegador.
- **Evals** (`pnpm evals`), cinco suites sobre casos fijos, guardadas en `eval_runs` / `eval_results` y en [../evals/resultados.md](../evals/resultados.md):

  | Suite | Puntaje |
  |---|---|
  | Textos | 100 |
  | Chat de edición | 100 |
  | Lectura de referencias (ida y vuelta) | 97 |
  | Verificador | 100 |
  | Diseño y diversidad | 100 |

- **CI en GitHub Actions:** tipos, lint, migraciones sobre Postgres, tests, evals de diseño y, si hay secretos, evals con modelos.

### Lo que las evals enseñaron

| Lo que pasó | Qué se ajustó |
|---|---|
| El chat, al pedir "fondo negro", también aclaró el texto para que se lea. Es correcto, y la eval lo penalizaba como "operación de más". | Se aceptan operaciones relacionadas |
| Al leer una pieza en "bloques", el modelo toma el bloque de color como fondo. Es ambiguo por diseño, no un error. | Se acepta el fondo o el color del bloque |
| El detector geométrico marcaba falsos positivos con interlineados menores a 1 y con rasgos de algunas serif | Tolerancia relativa al cuerpo y al interlineado, y más estricta de costado (donde un recorte se come letras) |
| El detector mostraba los textos con las "s" comidas | Una expresión regular perdió su barra dentro de un template literal y reemplazaba la letra "s" en lugar de espacios |

## Decisiones

D54 (control de calidad), D55–D59 (ver [decisiones.md](decisiones.md)).
