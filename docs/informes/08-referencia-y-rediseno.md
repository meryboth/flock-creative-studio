# 08 · La referencia como inspiración y el rediseño del estudio

**Fecha:** 2026-10-09

## Referencia gráfica → estilo propio

**Objetivo:** que la persona suba una pieza gráfica que le guste y el sistema tome su **esencia** como inspiración para toda la familia de piezas, en lugar de limitarse a elegir uno de los estilos fijos.

### Cómo funciona

```
imagen ──► código: colores medidos (dominante por píxeles + característicos)
       └─► Gemini con visión: qué se ve, clima, carácter tipográfico, tipo de formas,
           esquinas, fondo plano o con degradado (salida estructurada, catálogo cerrado)
                 │
                 ▼
         estilo "Tu referencia" = piezas del catálogo combinadas con esos parámetros
```

- **El modelo elige, no inventa.** La tipografía sale de 4 familias display, el visual de 4 generadores, y los colores de los medidos en la imagen. Así la lectura es precisa y el resultado siempre se puede producir.
- **Código y modelo se complementan.** El extractor de colores prioriza los colores vivos y no vio que el fondo de la portada de Flock es casi negro (sugirió un violeta saturado). Se sumó el color dominante medido por píxeles, y el modelo lo usa como fondo.
- **Resultado:** con el certificado del AI Day, el sistema recuperó solo el estilo original (Unbounded extendida en mayúsculas y extra negrita, azul profundo con degradado, esferas de luz), en unos 8 segundos.
- **Ajustes por calidad:**
  - las formas siempre se despegan del fondo (diferencia mínima de luminosidad);
  - el texto secundario se tiñe con el tono del fondo, nunca gris sobre color. El detector de Impeccable lo había marcado 13 veces.

### Key visual generado (opcional)

- Implementado detrás de una interfaz de proveedor: genera un visual original inspirado en la referencia, sin texto ni logos, sobre el color de fondo del estilo y fundido con las piezas.
- **Hoy no funciona con la key actual:** los modelos de imagen de Gemini devuelven 429 (cuota cero en el plan gratuito). La app muestra un aviso claro. Opciones: activar la facturación en el proyecto de Google Cloud, o **ComfyUI local** (instalado, pero sin modelos: hay que descargar uno, ~7 GB para SDXL).
- **Modelos:** `gemini-3.5-flash` lee una imagen en 5 a 12 segundos y redacta textos en segundos. Antes, con `3.7/3.8-flash`, tardaba unos 100 segundos.

## Rediseño: Flock Creative Studio

La app pasó a llamarse **Flock Creative Studio** y se rediseñó a partir de una referencia visual que eligió la usuaria: un cuaderno de estudio sobre una plancha de corte.

| Elemento de la referencia | En la app |
|---|---|
| Grilla gris de fondo | plancha de corte detrás de la hoja |
| Hoja de papel rayado | contenedor de toda la app |
| Nombre en tipografía pixel con marco dibujado a mano | "CREATIVE STUDIO" en Pixelify Sans, marco en naranja Flock |
| Stickers de colores con borde recortado | tipos de pieza, estados, clima de la referencia |
| Notas manuscritas con flechas | anotaciones en Caveat con flechas SVG |
| Cinta adhesiva | piezas, vista previa, estilo elegido, post-it "lo que vimos" |
| Pestañas de carpeta de colores | eventos en la lista y pasos del formulario |
| Botones negros con texto en mono | acciones principales |

**Qué no se copió, siguiendo el piso de calidad de Impeccable:**
- los rótulos chicos encima del título pasaron a ser anotaciones al costado, con flecha;
- los emojis como íconos se reemplazaron por trazos SVG;
- los círculos de redes sociales se sacaron porque acá no significan nada.

El detector no encuentra problemas en la app; solo deja una nota de advertencia sobre el fondo de grilla. Se mantiene porque representa la plancha de corte de la referencia.

**Contratiempos técnicos:**
- Con Cache Components, `usePathname()` tiene que ir dentro de `<Suspense>`: las pestañas se muestran primero sin marcar la activa.
- En celular, la grilla del formulario se desbordaba por el ancho mínimo de su contenido: se resolvió con `grid-cols-1` y `min-w-0`.
