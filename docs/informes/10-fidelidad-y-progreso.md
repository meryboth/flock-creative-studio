# 10 · Fidelidad a la referencia e indicadores de progreso

**Fecha:** 2026-10-09

## El problema: "solo replicó los colores"

La usuaria subió una referencia **pixel art**: tipografía pixel, papel cuadriculado, flores de contorno pixeladas, nubes, íconos pixel y un borde dentado rosa. El estilo resultante tomó el rosa y el verde y nada más: tipografía ancha redonda y formas geométricas tipo Bauhaus.

**Diagnóstico:** el modelo de visión **sí vio lo esencial**. Su descripción decía "estética retro y pixel art con fondo de cuadrícula". Pero el catálogo cerrado entre el que podía elegir no tenía nada para expresarlo, así que eligió lo más parecido disponible. **El cuello de botella era el vocabulario del sistema, no el modelo.**

## La solución: ampliar el vocabulario (sin dejar que el modelo invente)

| Dimensión | Antes | Ahora |
|---|---|---|
| Tipografías display | 4 | 10: se sumaron pixel (Pixelify Sans, Silkscreen), condensada de afiche (Bebas Neue), serif editorial (Instrument Serif), manuscrita (Caveat) y mono (JetBrains Mono) |
| Visual | 4 generadores | 6: se sumaron `pixel` y `doodle` |
| Motivos | — | flor, nube, corazón, estrella, destello, garabato |
| Textura del fondo | — | cuadrícula, puntos, renglones, liso |
| Caja del texto | mayúsculas / título | + minúsculas |
| Técnica (para el key visual) | siempre "escultura 3D" | pixel art, render 3D, ilustración plana, dibujo a mano, foto, degradado |

- **Motivos en código:** cada motivo es una forma matemática (la flor como unión de pétalos, el corazón por su curva) que se **rasteriza** a una grilla para el pixel art, con contorno o relleno, o se **traza** con un leve temblor para el dibujo a mano. Se ubican sin pisarse y sin salirse del lienzo.
- **Resultado con la misma referencia:** Silkscreen en mayúsculas, fondo cuadriculado, flores, nubes y corazones pixel art, y texto negro.

### Key visual en pixel art

- **SDXL base es flojo para pixel art:** el primer intento dibujó un pasillo de servidores en perspectiva. Además, el prompt describía el fondo ("grid background") y el modelo pintó una grilla.
- **Pixelado determinístico:** cuando la técnica es pixel art, la imagen generada se recorta, se baja a unas 40 celdas, se endurece la transparencia, se cuantiza a 10 colores y se agranda sin suavizar. **El modelo se acerca; el código lo termina.**
- **Prompts por técnica:** el sujeto tiene que ser simple y legible (un objeto o personaje original), sin fondo, y el negativo cambia según la técnica (para pixel art excluye perspectiva, 3D y foto).
- **Con key visual, los motivos de fondo no compiten:** se dibujan solo si no hay un objeto propio, salvo el brillo de las esferas.
- **Lecturas estables:** la temperatura del modelo de visión bajó de 0,4 a 0,15, porque dos lecturas de la misma imagen daban colores de texto distintos.

## Indicadores de progreso

Antes, mientras se procesaba, solo había un texto ("mirando…").

- **Componentes en el lenguaje de la app:**
  - **loader pixel** de 3×3 cuadraditos que se encienden en espiral;
  - **lista de etapas** con casilleros (tilde, loader o vacío);
  - **barra de progreso**, con porcentaje o rayada en movimiento;
  - **contador de tiempo**.
  - Todo respeta "reducir movimiento".
- **Lectura de la referencia:** etapas (subir, medir colores, leer con IA, armar el estilo) y una vista previa "en construcción".
- **Key visual con progreso real:** ComfyUI informa cada paso del sampler por **WebSocket**. La app lo guarda en memoria y la interfaz lo consulta cada segundo: "Generando la imagen con ComfyUI · paso 17 de 28", y después "Recortando el objeto".
- **Generación del evento:** etapas con el detalle de la pieza en curso (por ejemplo, "23 de 41 · cronograma resumen").
- **Vistas previas:** loader mientras carga cada iframe.

**Contratiempo:** el servidor de desarrollo no recompiló el CSS después de agregar reglas al final de `globals.css`. Se diagnosticó revisando la hoja compilada: terminaba en la última regla anterior al cambio. Se resolvió reiniciando el servidor.
