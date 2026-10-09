# Resultados de las evals

Generado: 9/10/26, 4:20 p. m. · proveedores claude, gemini. Muestra la última corrida de cada suite.
Se genera con `pnpm evals` (ver [../metricas-y-evals.md](../metricas-y-evals.md)). El historial completo queda en la base (`eval_runs`, `eval_results`) y en la página Métricas.

## Textos · 100/100 (3 de 3 casos)

Redacción de posteos, mensajes de Slack y landing: estructura por momentos, hashtag, largos, voseo, cantidad de emojis y que no invente datos.

Corrida: 9/10/26, 4:20 p. m. · 26 s · commit 4ab1ce5

| Caso | Puntaje | Detalle |
|---|---|---|
| ✅ hack-night-es | 100 | model: claude:claude-sonnet-5-5 |
| ✅ outdoor-sin-agenda | 100 | model: claude:claude-sonnet-5-5 |
| ✅ ai-day-en | 100 | model: claude:claude-sonnet-5-5 |

## Chat de edición · 100/100 (15 de 15 casos)

Pedidos en lenguaje natural → operaciones: tiene que proponer exactamente lo pedido, respetar el logo y no inventar operaciones para lo que no se puede.

Corrida: 9/10/26, 4:20 p. m. · 14 s · commit 4ab1ce5

| Caso | Puntaje | Detalle |
|---|---|---|
| ✅ titulo-grande | 100 | ops: setTitleScale:1.2 · Dale, te agrando el título un 20% en todas las piezas. |
| ✅ titulo-mucho-mas-chico | 100 | ops: setTitleScale:0.7 · Dale, achico bastante el título en todas las piezas (a 0.7 del tamaño actual). |
| ✅ fondo-negro | 100 | ops: setColor:#0d0d0d; setColor:#fbf9f7; setColor:#a8a39e · Listo, paso el fondo a negro. Como el texto actual es oscuro y no se leería, también lo cambio a un blanco cálido, y aclaro el texto secundario. Los acentos naranja y azul quedan igual y se ven bien sobre negro. |
| ✅ sacar-hashtag | 100 | ops: hide:hashtag · Listo, saco el hashtag de todas las piezas. |
| ✅ mostrar-fecha | 100 | ops: show:date · Listo, vuelvo a mostrar la fecha en todas las piezas. |
| ✅ mayusculas | 100 | ops: setCase:upper · Listo, pongo todos los títulos en mayúsculas. |
| ✅ bloques | 100 | ops: setLayout:bloques · Dale, paso todo a composición de bloques: planos de color grandes con el texto adentro. |
| ✅ nombre-gigante | 100 | ops: setLayout:tipografico · Dale, paso la composición a tipográfico: el nombre del evento va gigante de borde a borde y el visual queda superpuesto. |
| ✅ serif-elegante | 100 | ops: setFont:Gloock · Dale, paso los títulos a Gloock, una serif display de alto contraste, elegante y cálida. Se aplica a todas las piezas. |
| ✅ semitono | 100 | ops: setDevice:halftone:1 · Listo, le sumo la trama de puntos de semitono a todas las piezas. |
| ✅ visual-chico | 100 | ops: setVisualScale:0.7 · Dale, te achico el visual a un 70% del tamaño actual en todas las piezas. |
| ✅ dos-cambios | 100 | ops: setTitleScale:1.2; hide:tagline · Dale, agrando el título un poco (x1.2) y saco la frase (tagline) en todas las piezas. |
| ✅ cambiar-titular | 100 | ops: setCopy · Listo, cambio el titular de esta pieza por "Llega la Hack Night". |
| ✅ logo-protegido | 100 | ops:  · El logo de Flock no se puede sacar ni modificar, queda fijo en todas las piezas. Si querés, puedo achicar el visual, ocultar el hashtag, la frase o la fecha, o cambiar la composición para que quede más aire alrededor del logo. |
| ✅ fuera-de-alcance | 100 | ops:  · Eso no se puede: solo trabajo con piezas gráficas estáticas, así que no puedo agregar video, animación ni música. Sí puedo tocar colores, tipografías, composición, tamaños o mostrar y ocultar elementos. ¿Probamos algo de eso? |

## Lectura de referencias · 97/100 (7 de 7 casos)

Ida y vuelta: se renderiza una pieza con un estilo conocido, el modelo con visión la lee como si fuera una referencia y se compara lo que leyó con el estilo de origen (composición, caja, esquema, tipo de letra, color de fondo).

Corrida: 9/10/26, 4:20 p. m. · 16 s · commit 4ab1ce5

| Caso | Puntaje | Detalle |
|---|---|---|
| ✅ editorial-serif | 100 | deltaE: 8 · leído: tipografico · Instrument Serif · title · #f8e8e8 · origen: tipografico · Instrument Serif · #f3ede2 |
| ✅ suiza | 100 | deltaE: 1 · leído: bloques · Archivo · upper · #f8f8f8 · origen: bloques · Archivo · #ffffff |
| ✅ collage-riso | 100 | deltaE: 2 · leído: bloques · Familjen Grotesk · lower · #f848a8 · origen: bloques · Bricolage Grotesque · #f6f1e7 |
| ✅ flock | 100 | deltaE: 2 · leído: bloques · Inter Tight · title · #f85808 · origen: bloques · Familjen Grotesk · #180026 |
| ✅ grilla | 100 | deltaE: 2 · leído: tipografico · Archivo Black · upper · #f8f8f8 · origen: tipografico · Archivo Black · #fcf9f9 |
| ✅ organico | 80 | falla: tipo de letra (categoría) · deltaE: 3 · leído: clasico · Fraunces · title · #083828 · origen: clasico · Young Serif · #003921 |
| ✅ iridiscente | 100 | deltaE: 5 · leído: tipografico · Unbounded · lower · #080828 · origen: tipografico · Syne · #030433 |

## Verificador de lectura · 100/100 (5 de 5 casos)

Piezas sanas y piezas rotas a propósito (hora cortada, nombre tapado, título que se sale): el verificador tiene que marcar las rotas y dejar pasar las sanas.

Corrida: 9/10/26, 4:20 p. m. · 6 s · commit 4ab1ce5

| Caso | Puntaje | Detalle |
|---|---|---|
| ✅ slide-sana | 100 | falla: marcada, rota a propósito · leído: hora de inicio: ok «19:00»; título: ok «ARMADO DE EQUIPOS» |
| ✅ slide-hora-cortada | 100 | leído: hora de inicio: cortado «19:0»; título: ok «ARMADO DE EQUIPOS» |
| ✅ credencial-sana | 100 | falla: marcada, rota a propósito · leído: nombre: ok «MARÍA CONSTANZA»; apellido: ok «FERNÁNDEZ DE LA FUENTE» |
| ✅ credencial-apellido-tapado | 100 | leído: nombre: ok «MARÍA CONSTANZA»; apellido: cortado «FERNÁ» |
| ✅ slide-titulo-fuera | 100 | leído: hora de inicio: ok «19:00»; título: cortado «ARMADO» |

## Diseño y diversidad · 100/100 (14 de 14 casos)

Sin modelos: cada estilo del catálogo en sus 3 variantes, posteo y slide. Ningún texto recortado, el detector de Impeccable sin hallazgos, y que las variantes se diferencien de verdad (distancia visual y combinaciones distintas de composición y fuente).

Corrida: 9/10/26, 4:20 p. m. · 5 s · commit 4ab1ce5

| Caso | Puntaje | Detalle |
|---|---|---|
| ✅ flock-1 | 100 | fuente: Bricolage Grotesque · composición: tipografico · textos recortados: 0 |
| ✅ flock-2 | 100 | fuente: Familjen Grotesk · composición: bloques · textos recortados: 0 |
| ✅ flock-3 | 100 | fuente: Epilogue · composición: clasico · textos recortados: 0 |
| ✅ grilla-1 | 100 | fuente: Archivo · composición: bloques · textos recortados: 0 |
| ✅ grilla-2 | 100 | fuente: Archivo Black · composición: tipografico · textos recortados: 0 |
| ✅ grilla-3 | 100 | fuente: Big Shoulders Display · composición: clasico · textos recortados: 0 |
| ✅ organico-1 | 100 | fuente: Gloock · composición: bloques · textos recortados: 0 |
| ✅ organico-2 | 100 | fuente: Young Serif · composición: clasico · textos recortados: 0 |
| ✅ organico-3 | 100 | fuente: DM Serif Display · composición: tipografico · textos recortados: 0 |
| ✅ iridiscente-1 | 100 | fuente: Unbounded · composición: clasico · textos recortados: 0 |
| ✅ iridiscente-2 | 100 | fuente: Syne · composición: tipografico · textos recortados: 0 |
| ✅ iridiscente-3 | 100 | fuente: Krona One · composición: bloques · textos recortados: 0 |
| ✅ impeccable | 100 | hallazgos: 0 |
| ✅ diversidad | 100 | distancia visual media: 0.392 · combinaciones composición + fuente: 12 de 12 |
