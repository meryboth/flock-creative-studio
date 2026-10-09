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
| D10 | 2026-10-09 | Editor conversacional con alcance por cambio (todas / específicas / la seleccionada) y operaciones tipadas | que la IA edite el HTML | validable, reversible, sin romper la marca | ✅ (ver D36–D38) |
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
| D25 | 2026-10-09 | ComfyUI local con SDXL base 1.0 como primer proveedor de key visuals | Gemini Image con facturación; Flux | gratis, local, licencia comercial; entra en 18 GB | 🔁 reemplazada por D33 (queda como respaldo) |
| D26 | 2026-10-09 | Recortar siempre el visual generado y apoyarlo sobre el fondo real del estilo | confiar en el fondo que pinta el modelo | SDXL no respeta colores ni "fondo liso" | ✅ |
| D27 | 2026-10-09 | Biblioteca de estilos del equipo; los eventos guardan su copia del estilo y del key visual | referenciar el estilo de la biblioteca desde el evento | se pueden borrar estilos sin romper eventos | ✅ |
| D28 | 2026-10-09 | Repo público sin piezas de la agencia, material interno ni nombres reales | subir todo; repo privado | decisión de la usuaria | ✅ |
| D29 | 2026-10-09 | Ampliar el vocabulario del estilo (10 tipografías, generadores pixel y doodle, motivos, texturas, técnica) en lugar de soltar el catálogo cerrado | dejar que el modelo genere CSS o fuentes libres | el modelo veía bien la referencia, pero no podía expresarlo; el catálogo cerrado mantiene el control | ✅ |
| D30 | 2026-10-09 | Pixel art del key visual terminado por código (pixelado y paleta corta) | depender solo de SDXL; modelos o LoRAs de pixel art | resultado garantizado y sin descargas extra | ✅ |
| D31 | 2026-10-09 | Progreso real del key visual vía WebSocket de ComfyUI, guardado en memoria y consultado por la UI | barra simulada | refleja el avance real (paso N de 28) | ✅ (con varios procesos iría a la base) |
| D32 | 2026-10-09 | Temperatura 0,15 en la lectura de referencias | 0,4 | la misma imagen tiene que dar la misma lectura | ✅ |
| D33 | 2026-10-09 | Gemini Image como proveedor principal de key visuals; ComfyUI como respaldo local | mantener ComfyUI primero | en la comparación con la referencia pixel: resultado mucho más limpio y fiel, recibe la referencia como imagen, ~12 s contra ~150 s; costo de centavos por imagen | ✅ |
| D34 | 2026-10-09 | Elementos decorativos generados con IA por estilo (3–4, en paralelo con el key visual), con sprites de código como respaldo | solo sprites de código; generar piezas completas con IA | máxima fidelidad a la referencia sin perder el control de la composición | ✅ |
| D35 | 2026-10-09 | Prohibir en los prompts reproducir personajes, mascotas u objetos de la referencia | confiar en "inspirado en" | Gemini copió la mascota de una marca ajena | ✅ |
| D36 | 2026-10-09 | El chat traduce cada pedido a operaciones tipadas (color, tipografía, escala, ocultar, texto, variante, key visual) validadas por código | que el modelo edite HTML o CSS | el resultado sigue siendo de la marca y se puede deshacer | ✅ |
| D37 | 2026-10-09 | Cambios guardados como parches por alcance (todas → grupo → pieza) que se aplican al regenerar | editar los archivos generados | una variante o un cambio de texto no pisa los ajustes; deshacer = restaurar la foto previa | ✅ |
| D38 | 2026-10-09 | La regeneración escribe en una carpeta aparte y reemplaza solo las carpetas de piezas | vaciar `storage/<evento>` y regenerar | las piezas siguen visibles mientras se regeneran; antes se borraba `inputs/` (key visual) | ✅ |
| D39 | 2026-10-09 | Comunicación por momentos: antes, durante y después del evento, en LinkedIn (público) y Slack (interno) | anuncio, agenda y gracias | cada pieza tiene un cuándo y un accionable claro | ✅ |
| D40 | 2026-10-09 | Programación propia (tabla `scheduled_posts` + despachador cada minuto en `instrumentation.ts`) con conectores a las APIs de Slack y LinkedIn | programación nativa de cada red; Zapier o similar | Slack no programa mensajes con archivos y LinkedIn no expone programación; todo queda local | ✅ código · ⏳ tokens de Slack y LinkedIn |
| D41 | 2026-10-09 | Sync con la nómina desde un link de SharePoint u OneDrive: hoy, links que no piden inicio de sesión; el camino definitivo sigue siendo Graph (D19) | esperar a IT | se puede probar el circuito completo ya; el servidor solo descarga de hosts de Microsoft 365 | ✅ parcial · ⏳ Entra ID |
| D42 | 2026-10-09 | Descargas en .zip (credenciales o familia completa) armadas al vuelo con fflate | guardar zips en disco | siempre reflejan las piezas vigentes | ✅ |
| D43 | 2026-10-09 | Claude (Sonnet 5.5) como primer proveedor de textos, editor y visión, Gemini de respaldo; módulo único de proveedores | solo Gemini | calidad de redacción y lectura; sin depender de un solo proveedor. Las imágenes siguen en Gemini | ✅ |
| D44 | 2026-10-09 | Calendario de publicaciones con lo programado y lo sugerido de todos los eventos | listado por evento | ver de un vistazo qué sale y qué falta programar | ✅ (mail pendiente) |
| D45 | 2026-10-09 | Separar marca (Flock) de campaña (AI Day): el AI Day pasa a ser un estilo y una composición, y Flock es el estilo por defecto | mantener el esqueleto del AI Day | todo se parecía a la primera referencia | ✅ |
| D46 | 2026-10-09 | Tres composiciones (clásico, tipográfico, bloques) que la referencia elige y la variante rota | más decoración sobre el mismo esqueleto | la composición es lo que más define una familia | ✅ posteo y cronograma · ⏳ credenciales, certificados, landing |
| D47 | 2026-10-09 | Catálogo de 28 fuentes con ficha de carácter; combinaciones por estilo que rotan con la variante | elegir por nombre de una lista corta | la IA elige por carácter; más variedad sin perder control | ✅ |
| D48 | 2026-10-09 | Crítico de fidelidad con visión y anti-referencia (AI Day); acepta cambios solo con +0,5 | confiar en la primera lectura | corrige lecturas flojas y explica qué falta | ✅ |
| D49 | 2026-10-09 | Hoja de contactos (`pnpm diversity`) como prueba de regresión de diversidad | mirar piezas sueltas | se ve de un vistazo si todo converge al mismo esquema | ✅ |
| D50 | 2026-10-09 | Slack preparado sin conectar: programar cualquier pieza (texto, canal, día) y publicarla a mano (descargar, copiar, marcar publicada); manifiesto y guía listos | esperar a tener la app | el Slack de Flock no tiene lugar para apps nuevas; el circuito sirve igual y conectar es configuración | ✅ · ⏳ app de Slack |
| D51 | 2026-10-09 | Con la app conectada, programar en Slack mismo (`chat.scheduleMessage` con la imagen subida) detrás de `SLACK_NATIVE_SCHEDULE` | solo el despachador local | publica aunque la app esté cerrada | ⏳ sin probar |
| D52 | 2026-10-09 | Nómina desde la exportación de Forms (Excel o CSV) o un link de SharePoint; credencial impresa solo para presenciales, certificados para todos los confirmados | pedir un formato propio | People carga lo que ya tiene, sin transformar nada | ✅ |
| D53 | 2026-10-09 | Piezas opcionales por evento (certificados apagados por defecto); se suman o se sacan desde el evento | generar siempre todo | no todos los eventos necesitan todo; menos ruido en la galería | ✅ |
