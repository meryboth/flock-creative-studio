# 14 · Diversidad: salir del esqueleto del AI Day

**Fecha:** 2026-10-09

## El problema

Dos quejas de la usuaria, con la misma raíz:

1. Los resultados eran genéricos. Ante una referencia como *praktika* (grotesca extendida gigante en minúscula, bloques de color, píldoras, ilustración de línea con semitono), la pieza salía con un título chico, la caja "9:30 – 10:30 hs | charla" y manchas en una esquina.
2. Todo se parecía a lo primero que se había mandado como referencia: las piezas del AI Day 2026.

**Diagnóstico, confirmado en el código:** las plantillas se habían construido copiando las piezas del AI Day, y ese ADN quedó como esqueleto de todo:

- logo arriba a la izquierda, píldora con la fecha y hashtag abajo a la izquierda;
- la caja "hora | título";
- Unbounded como la única fuente ancha;
- "iridiscente" como estilo por defecto.

Los estilos y las referencias solo cambiaban la pintura (colores, fuente, decoración). La lectura de la referencia veía bien la composición, pero no tenía cómo expresarla. Es el mismo cuello de botella del informe 10: el vocabulario del sistema, no el modelo.

## Cómo se midió: hoja de contactos

`pnpm diversity` (`tools/diversity-sheet.ts`) renderiza las mismas piezas (un posteo y una slide del cronograma) para un set de referencias bien distintas y para los estilos del catálogo, y arma una sola imagen para compararlas:

- **Referencias reales** (`--ref nombre=ruta`): *praktika*, la pixel art y "aspas violetas". Se leen con visión, la lectura queda en caché y con `--critic` pasa por el crítico. Las imágenes no se copian al repo, porque pueden ser de terceros.
- **Lecturas escritas a mano** (`tools/diversidad/fixtures.json`): editorial con serif, suiza y collage en risografía, para cubrir estéticas que no tenían imagen.
- **Catálogo:** cada estilo en sus variantes 1, 2 y 3.

La hoja "antes" mostró el problema de un vistazo: diez referencias y estilos muy distintos con exactamente la misma composición.

## Qué se cambió

### 1. Marca y campaña, separadas

- Lo de Flock (logo y sus versiones, zona de respeto, contraste) sigue en todas las piezas.
- Lo del AI Day pasa a ser un estilo más ("Iridiscente · AI Day") y una composición más ("clásico").
- El estilo por defecto al crear un evento pasa a ser **Flock** (la marca), y el del AI Day queda último en la lista.

### 2. Composiciones (layouts)

El posteo (cuadrado y apaisado, que también usa Slack), la slide del cronograma y el cronograma completo tienen tres composiciones:

| Composición | Cómo es |
|---|---|
| `clasico` | El esquema del AI Day: logo arriba, título abajo, visual en la esquina, caja "hora \| título" |
| `tipografico` | La tipografía es la imagen: el nombre del evento (o la hora, en el cronograma) gigante de borde a borde, con el visual superpuesto como un objeto apoyado sobre las letras |
| `bloques` | Planos de color grandes con esquinas redondeadas, con el texto adentro; color de texto calculado para que se lea sobre el bloque |

Cada estilo tiene un orden de composiciones y **"Otra variante" rota entre ellas**. En una referencia, la composición leída va primera y la clásica última.

### 3. Recursos gráficos

- **Píldoras de color:** fecha, lugar y hashtag rellenos con el segundo acento.
- **Semitono:** tramas de puntos en círculos detrás del visual y en los bloques.

La lectura de la referencia decide cuáles aparecen.

### 4. Fuentes: de 12 a 28, elegidas por carácter

- Se sumaron 16 fuentes OFL, todas con ñ y tildes. Entre otras: extendidas (Krona One, Syne, Lexend Zetta, Dela Gothic One, Rubik Mono One), grotescas (Archivo Black, Space Grotesk, Familjen Grotesk, Epilogue, Inter Tight), condensadas (Anton, Big Shoulders Display), serif (DM Serif Display, Fraunces, Young Serif) y DM Sans para texto.
- Cada fuente tiene su **ficha**: categoría, uso (títulos o texto), carácter en una frase, peso máximo, ancho, y si dibuja mal números o solo tiene mayúsculas. La lectura de referencias, el crítico y el chat de edición eligen por carácter, no por nombre.
- Cada estilo del catálogo tiene **tres combinaciones de fuentes** que rotan con la variante. Ejemplo: Grilla alterna entre Archivo extendida, Archivo Black y Big Shoulders.
- Las fuentes de un solo peso declaran todo el rango, así el navegador nunca inventa una negrita.

### 5. Técnicas de ilustración

Se sumaron línea con semitono, risografía y collage, con su frase de estilo y su negativo para la generación de key visuals y elementos.

### 6. Crítico de fidelidad

Funciona así (`agents/critic.ts` + `studio/refine.ts`):

1. Se renderiza un posteo de prueba con el estilo leído.
2. Claude con visión lo compara con la referencia y con una **anti-referencia**: la misma pieza en el estilo del AI Day.
3. Puntúa tipografía, color, composición (con más peso) e ilustración, y propone cambios dentro del vocabulario del sistema.
4. Si la pieza se parece más al AI Day que a la referencia, la nota queda topeada en 4.
5. Se aplican los cambios y se repite. Al final queda la versión mejor puntuada.

En la app, el crítico corre al subir una referencia (`CRITIC_ROUNDS`, 1 por defecto, unos 15 s por ronda), y la crítica queda guardada junto a la lectura.

### 7. Editor conversacional

- Operaciones nuevas: `setLayout` ("probá con bloques de color", "que el nombre sea gigante") y `setDevice` (sumar o sacar píldoras y semitono).
- `setFont` ahora ofrece las 28 fuentes con su carácter.

## Calidad (Impeccable)

El detector, corrido sobre las tres composiciones de los cuatro estilos, marcó:

- **Contraste bajo en "bloques":** era un falso positivo estructural, porque el texto estaba encima del bloque pero era hermano en el HTML. Ahora vive dentro del bloque.
- **"Fuente sobreusada":** Fraunces y Space Grotesk salieron de las combinaciones del catálogo. Siguen disponibles si una referencia las pide.
- **Fondo "crema" en Grilla:** era el tinte cálido del papel; ahora es casi neutro.

Resultado final: sin hallazgos.

## Resultados

Tres hojas de contactos (`storage/diversidad/`, fuera del repo porque incluyen referencias de terceros):

| Hoja | Qué muestra |
|---|---|
| **antes** | 10 filas (3 referencias, 3 lecturas escritas a mano, 4 estilos del catálogo) con **la misma composición**: logo arriba, título abajo, visual en la esquina, caja "hs \|" |
| **después** | Tres composiciones conviviendo. *praktika*: tipográfica, en minúscula, con píldoras lila y semitono. Pixel art: tipográfica con letra pixel. La suiza: bloques rojos. El collage: bloques rosa flúor. Cada estilo del catálogo cambia de composición y de fuentes con la variante. El esquema del AI Day solo aparece en "Iridiscente · AI Day", variante 1, y cuando una referencia se le parece (las "aspas violetas", 3D violeta sobre fondo oscuro, lo eligen con razón) |
| **crítico** | Las mismas referencias reales después del lazo de fidelidad |

### Lo que dijo el crítico

El crítico resultó más útil como **diagnóstico** que como corrector:

- ***praktika*** (5,4 a 6,2): lo que más aleja es el visual. Son formas abstractas planas, y la referencia es ilustración de línea negra con personaje y semitono.
- **Pixel art** (7,0 a 7,1): muy cerca en tipografía y fondo; los sprites tienen sombreado y la referencia es plana con contorno.
- **Aspas violetas** (5,4 a 6,0): el visual (manchas difusas) no tiene nada que ver con las láminas 3D nítidas de la referencia.

En los tres casos, el límite es el **visual**, y el código solo no lo resuelve: hace falta el key visual y los elementos generados con IA en la técnica de la referencia. En la app eso ya existe ("Generar gráficos con IA") y ahora tiene las técnicas que faltaban (línea con semitono, risografía, collage). La hoja de contactos no los genera, para medir solo lo que hace el código.

### Ajustes del crítico en el camino

| Problema | Solución |
|---|---|
| Diferencias de 0,1 entre rondas son ruido | Un estilo ajustado reemplaza al original solo si mejora **medio punto o más** |
| Con Claude, el esquema de cambios (muchos campos opcionales con opciones cerradas) daba "Schema is too complex". Sonnet tardaba hasta el timeout y caía a Gemini: un pedido llegó a tardar 6 minutos | Los cambios pasaron a ser una lista de pares campo → valor, validados en código. Cada crítica tarda ~5 s y la lectura completa con crítico, ~13 s |

## Límites y próximos pasos

- **Composiciones:** las tres nuevas cubren el posteo y el cronograma. Credenciales, certificados y landing siguen con su diseño único.
- **Variedad:** la lectura de la referencia no es determinística con Claude 5.x (no acepta temperatura). La misma imagen puede salir "tipográfico" o "bloques"; las dos son válidas, y el crítico y "Otra variante" lo compensan.
- **Fuentes:** el modelo de visión todavía tiende a fuentes conocidas (Bricolage en vez de Krona One para *praktika*). Se podría probar con una muestra visual de cada fuente en el prompt.
