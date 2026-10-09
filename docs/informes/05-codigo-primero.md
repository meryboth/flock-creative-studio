# 05 · Código primero: estilos generativos y textos con Gemini

**Fecha:** 2026-10-09

## El cambio de enfoque

Hasta acá, las piezas eran 100% código pero estaban atadas a un evento (el AI Day). Dos definiciones cambiaron el rumbo:

1. **El foco es el circuito, no un evento:** el usuario define un evento y un estilo, y obtiene una familia de piezas.
2. **Generar con código en lugar de pedirle imágenes a una IA**, apoyándose en buenas prácticas y librerías de diseño.

## Qué genera el código y qué la IA

| Tarea | Quién | Por qué |
|---|---|---|
| Paletas | código (`culori`, OKLCH) | contraste WCAG AA garantizado por cálculo |
| Visual de cada pieza | código (SVG/CSS con semilla) | reproducible, gratis, instantáneo, sin cortes, editable por parámetros |
| Tipografía, composición, tratamiento | código (catálogo cerrado por estilo) | la IA no inventa diseño |
| Leer el moodboard | código (`node-vibrant`) | extrae colores dominantes y sugiere un estilo sin IA |
| **Textos** (posteos, landing) | **Gemini** | redactar bien en español e inglés no se resuelve con plantillas |
| Interpretar pedidos en lenguaje natural (editor por chat, próximo) | LLM | traducir "la flor más chica" a parámetros |

## Catálogo de estilos (v1)

| Estilo | Mundo | Visual generado |
|---|---|---|
| Iridiscente | fondo profundo, brillo | esferas de luz desenfocadas en tonos del acento |
| Grilla | claro, constructivista | formas geométricas sobre una grilla modular |
| Flock | institucional | piezas del isotipo con el degradado de marca |
| Orgánico | tonos profundos, natural | formas suaves superpuestas |

Cada estilo define su par tipográfico (fuentes OFL locales), su tratamiento de títulos, radios y trazos, y cómo deriva la paleta de uno o dos colores semilla. **Cambiar la semilla da una variante nueva; la misma semilla siempre da el mismo resultado.** El AI Day pasó a ser un evento de ejemplo: estilo Iridiscente con una imagen propia opcional.

Con los mismos datos, los cuatro estilos generan familias claramente distintas (40 piezas cada una, entre 3,5 y 14 segundos) y todas pasan el QA de diseño.

## Gemini

- Salida estructurada con **Zod** vía LangChain (`withStructuredOutput`): 3 posteos (anuncio, agenda, gracias) con titular, bajada y texto, más los textos de la landing.
- El prompt prohíbe inventar datos (speakers, cifras, lugares) que no estén en el evento.
- **Cadena de modelos de respaldo** (`GEMINI_MODELS`): en la prueba, `gemini-2.5-flash` ya no estaba disponible para cuentas nuevas, `gemini-3.8-flash` devolvió 503 por demanda y la redacción salió con `gemini-3.7-flash`. Si ninguno responde, se usan textos base armados con los datos.
- **Latencia real: ~100 s.** Por eso la generación tiene que correr en segundo plano, con progreso visible.
- La API key vive solo en `.env` (fuera de git).

## Pendientes detectados

- En el estilo Orgánico, la serif display dibuja mal horarios y `#`: usar la fuente de cuerpo para números.
- Formas orgánicas todavía básicas.
