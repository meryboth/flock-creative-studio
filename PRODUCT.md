# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cualquier flocker (persona de Flock IT) que organice un evento interno: principalmente el equipo de People Experience, que arma 1 o 2 eventos grandes por año (por ejemplo, AI Day u Outdoor), pero también equipos que organizan meetups, charlas o encuentros más chicos. En general no tienen formación en diseño. Su trabajo es ir de una temática y unas referencias visuales a un set de piezas listas para comunicar el evento.

## Product Purpose

Flock Creative Studio genera la identidad visual de un evento y todas sus piezas gráficas, de forma local y guiada por agentes de IA. **El éxito es reemplazar a la agencia BrandBox**: las piezas tienen que salir listas para publicar e imprimir, sin pasar por un estudio externo.

## Positioning

Primero define un **sistema de identidad por evento** (key visual, paleta, tipografías, componentes y copy base: el "Event Kit"), elegido e iterado por la persona entre varias direcciones creativas. Después aplica ese sistema a plantillas determinísticas. La IA explora; el código compone. El logo y las reglas de marca de Flock nunca los genera ni los altera la IA.

## Operating Context

- Proceso actual: se define una temática, se le piden piezas a BrandBox (y a marketing) y se espera. Hay poco margen para iterar.
- Inputs: brief del evento (nombre, temática, fecha, lugar, tono), moodboard o imágenes de referencia, agenda (tabla o CSV) y lista de asistentes (CSV).
- Outputs actuales: posteos de LinkedIn (imagen + texto), landing de una página (HTML autocontenido), cronograma (una slide por bloque + resumen), credenciales para imprimir (PDF A4 con marcas de corte) y certificados de participación. Pueden sumarse más.
- Todo corre local: Next.js, Postgres (OrbStack), Playwright. La única dependencia externa prevista es la API de un LLM (Gemini), intercambiable por modelos locales (Ollama, ComfyUI).

## Capabilities and Constraints

- Dos superficies de diseño: `apps/web` (la herramienta, donde se trabaja) y `packages/templates` (las piezas que se publican e imprimen).
- Las piezas se renderizan desde HTML/CSS con Playwright a PNG/PDF; la landing se entrega como un único `.html`.
- El modelo de imágenes genera objetos y fondos, nunca texto ni logos.
- Iteración por chat: la persona elige una o varias piezas, pide cambios en lenguaje natural y decide el alcance de cada cambio: todas las piezas, piezas específicas o solo la seleccionada. Los cambios se pueden deshacer.
- Idiomas: español e inglés (algunos eventos o piezas pueden ir en inglés).
- Abierto: autenticación y uso multiusuario (hoy es local, una Mac); fuentes definitivas de los eventos (hoy alternativas OFL: Unbounded + Manrope).

## Brand Commitments

- Marca Flock (`brand/brand.json`): logo horizontal en color, blanco y negro; isotipo en contorno; colores institucionales naranja `#FF5102`, violeta `#7F07C5`, violeta profundo `#44016B`, Violeta 3 `#180026`; degradado naranja → violeta.
- Reglas: no deformar, rotar, recolorear ni aplicar efectos al logo; no ponerlo sobre fondos sin contraste; nunca generarlo con IA.
- Cada evento tiene su propia paleta e identidad (el AI Day 2026 usó azul eléctrico, navy y un objeto 3D iridiscente, sin los colores institucionales). Lo fijo entre eventos es solo el logo y sus reglas.

## Evidence on Hand

- Piezas de BrandBox del AI Day 2026: `references/ai-day-2026/` (certificado, slides de cronograma).
- Portada "Flock | General": `references/flock-general-cover.png`; fondo de cintas violetas en `brand/elements/`.
- Event Kit de ejemplo del AI Day: `events/ai-day-2026/`. Los asistentes del CSV son ficticios.
- No hay todavía: manual de marca en PDF, fuentes institucionales, archivo original del key visual del AI Day, testimonios ni métricas de uso. No inventarlos.

## Product Principles

1. **Listo para publicar o no sale.** Cada pieza tiene que poder ir directo a LinkedIn o a la imprenta: resolución, márgenes, contraste y textos que entran.
2. **La identidad se elige, no se acepta.** La persona ve opciones, compara, bloquea lo que le gusta y regenera el resto.
3. **La marca es intocable; el evento es libre.** El logo y sus reglas no se negocian; todo lo demás puede cambiar por evento.
4. **Guiar a quien no diseña.** La herramienta toma las decisiones de oficio (jerarquía, tipografía, espaciado) para que nadie tenga que saber de diseño.
5. **Local y reemplazable.** Ningún proveedor de IA es imprescindible.

## Accessibility & Inclusion

- Contraste **WCAG AA** en la app y en todas las piezas (texto sobre key visuals y degradados incluido).
- Contenido en español e inglés: las plantillas tienen que tolerar textos más largos y caracteres acentuados.
