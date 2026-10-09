# Registro de decisiones

Una fila por decisión de arquitectura o de producto. Estado: ✅ vigente · 🔁 reemplazada · ⏳ pendiente.

| # | Fecha | Decisión | Alternativas consideradas | Motivo | Estado |
|---|---|---|---|---|---|
| D01 | 2026-10-09 | Next.js + LangGraph.js, todo en TypeScript | Python (FastAPI + LangGraph) | un solo lenguaje y un solo repo | ✅ |
| D02 | 2026-10-09 | Todo local; el LLM es la única dependencia externa | servicios en la nube | requisito del proyecto | ✅ |
| D03 | 2026-10-09 | La IA de imágenes nunca genera texto ni logos | piezas completas generadas por IA | los modelos fallan con tipografía, logo y color exactos | ✅ |
| D04 | 2026-10-09 | Primero la identidad (Event Kit), después las piezas | generar cada pieza por separado | un evento es un sistema; coherencia y edición global | ✅ |
| D05 | 2026-10-09 | PostgreSQL + pgvector en OrbStack (puerto 5433) | SQLite; Docker Desktop | un motor para datos, checkpoints y RAG; Docker Desktop anda mal en la Mac | ✅ |
| D06 | 2026-10-09 | Brand kit en `brand/` con manifiesto versionado | marca embebida en el código | fuente de verdad única; el logo es un archivo, nunca un prompt | ✅ |
| D07 | 2026-10-09 | Render con HTML/CSS + Playwright | Satori + resvg | soporte completo de CSS; mismo motor para la landing | ✅ (reemplaza a Satori de v0.1) |
| D08 | 2026-10-09 | Ajuste automático de texto dentro de la página | tamaños fijos | nombres largos y dos idiomas | ✅ |
| D09 | 2026-10-09 | Impeccable como criterio de diseño y detector en cada generación | revisión manual | calidad consistente y verificable | ✅ |
| D10 | 2026-10-09 | Editor conversacional con alcance por cambio (todas / específicas / la seleccionada) y operaciones tipadas | que la IA edite el HTML | validable, reversible, sin romper la marca | ⏳ diseñado |
| D11 | 2026-10-09 | **Código primero:** estilos, paletas y visuales generados con código y semilla | generar visuales con Gemini Image / ComfyUI | reproducible, local, gratis, sin cortes, editable por parámetros | ✅ (reemplaza al key visual por IA como camino principal) |
| D12 | 2026-10-09 | Gemini solo para textos, con salida estructurada y cadena de modelos de respaldo | LLM local (Ollama); textos por plantilla | calidad de redacción; los modelos cambian y se saturan | ✅ |
| D13 | 2026-10-09 | Moodboard analizado por código (colores dominantes → paleta y estilo sugerido) | análisis con un LLM de visión | suficiente para la v1, local e instantáneo | ✅ |
| D14 | 2026-10-09 | Generación en segundo plano con `after()` de Next.js y progreso en `runs` | generación sincrónica; cola con pg-boss | Gemini tarda ~100 s; para una sola Mac alcanza con `after()` | ✅ (pg-boss si hay varios usuarios) |
| D15 | 2026-10-09 | Plantillas con un runtime JSX propio que genera HTML, sin React | `react-dom/server` (bloqueado por Next en la app); externalizar el paquete; render en un proceso aparte | funciona dentro de Next, mismo resultado, menos dependencias | ✅ |
| D16 | 2026-10-09 | Vistas previas en vivo con assets por URL; render final con todo embebido | embebido siempre | previews de pocos KB que se recalculan al tipear | ✅ |
| D17 | 2026-10-09 | La lista de asistentes sale del formulario de creación | pedirla al crear el evento | no hace falta para definir un evento | ✅ |
| D18 | 2026-10-09 | Nómina como fuente intercambiable (`RosterSource`) que se lee al generar y se guarda como snapshot por evento | lista cargada por evento | eventos nuevos con flockers vigentes; piezas de eventos pasados estables | ✅ (mock) · ⏳ SharePoint |
| D19 | 2026-10-09 | Conector a la nómina vía Microsoft Graph con app de solo lectura (`Sites.Selected`) | link de descarga anónima | no exponer datos personales | ⏳ diseñado, requiere IT |
| D20 | 2026-10-09 | La referencia gráfica se lee con Gemini con visión (salida estructurada sobre un catálogo cerrado) más colores medidos por código | solo colores por código; generar piezas a partir de la imagen | captar la esencia (carácter, motivo, composición) sin perder control ni marca | ✅ |
| D21 | 2026-10-09 | Estilo "Tu referencia" armado con piezas del catálogo y parámetros leídos | elegir el estilo fijo más parecido | la referencia define el estilo, no solo lo sugiere | ✅ |
| D22 | 2026-10-09 | Key visual con IA detrás de un proveedor intercambiable (Gemini Image hoy, ComfyUI local como alternativa) | depender de un solo proveedor | la key gratuita no tiene cuota de imágenes; no frenar por eso | ✅ ComfyUI funcionando (ver D25) |
| D23 | 2026-10-09 | `gemini-3.5-flash` primero en las cadenas de texto y visión | 3.7/3.8-flash | ~5–12 s contra ~100 s | ✅ |
| D24 | 2026-10-09 | La app pasa a llamarse Flock Creative Studio, con lenguaje visual de cuaderno de estudio | mantener el tema oscuro genérico | referencia elegida por la usuaria; identidad propia de herramienta creativa | ✅ |
| D25 | 2026-10-09 | ComfyUI local con SDXL base 1.0 como primer proveedor de key visuals | Gemini Image con facturación; Flux | gratis, local, licencia comercial; entra en 18 GB | ✅ |
| D26 | 2026-10-09 | Recortar siempre el visual generado y apoyarlo sobre el fondo real del estilo | confiar en el fondo que pinta el modelo | SDXL no respeta colores ni "fondo liso" | ✅ |
| D27 | 2026-10-09 | Biblioteca de estilos del equipo; los eventos guardan su copia del estilo y del key visual | referenciar el estilo de la biblioteca desde el evento | se pueden borrar estilos sin romper eventos | ✅ |
| D28 | 2026-10-09 | Repo público sin piezas de la agencia, material interno ni nombres reales | subir todo; repo privado | decisión de la usuaria | ✅ |
