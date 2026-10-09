# 11 · Editor conversacional

**Fecha:** 2026-10-09

## Qué se buscaba

Generar la familia de piezas e **iterar cualquier cosa en lenguaje natural**: elegir una pieza (o ninguna), pedir un cambio y decidir a qué piezas se aplica. Son tres alcances: todas, el grupo de la pieza (todos los posteos, todas las credenciales…) o solo la elegida.

## Cómo funciona

1. **Galería seleccionable + chat fijo al costado.** Se elige una pieza con un clic (queda marcada con cinta y sombra amarilla) y se escribe el pedido. Sin pieza elegida, el cambio es general.
2. **Gemini interpreta, el código valida.** El pedido se traduce a **operaciones tipadas**: color de un rol (fondo, texto, acento), tipografía del catálogo, mayúsculas, peso, escala del título, escala del visual, ocultar o mostrar (hashtag, frase, fecha, visual), texto del titular o la bajada, otra variante y key visual nuevo. Cada operación se valida en código (colores hex, fuentes del catálogo, rangos), y lo que no pasa se descarta.
3. **Propuesta antes de aplicar.** El chat responde qué va a hacer, muestra las operaciones como chips y ofrece el alcance con la cantidad de piezas afectadas, con el que sugiere la IA ya elegido. Un cambio de texto es siempre "solo esta".
4. **Aplicar = guardar un parche y regenerar.** Los cambios visuales se guardan como **parches por alcance** en el evento (`overrides`: todas → grupo → pieza, el más específico gana). La regeneración los aplica pieza por pieza, y si cambia el fondo se recalculan la paleta y el contraste (WCAG AA).
5. **Deshacer.** Cada cambio aplicado guarda una foto previa (parches, textos, estilo). "Deshacer último" la restaura y regenera.

Todo queda en la tabla `change_sets`: pedido, respuesta, operaciones, alcance sugerido y elegido, y estado (propuesto, aplicado, descartado, deshecho).

## Prueba

En Hack Night 2026, con el posteo cuadrado elegido: *"el título más grande y el fondo negro"* → `título ×1.20` y `fondo → #000000`, alcance "Solo esta". Solo ese posteo pasó a fondo negro con el título más grande y el resto quedó igual. "Deshacer último" lo devolvió a su estado original.

## Un bug que apareció en el camino

La generación vaciaba la carpeta `storage/<evento>` entera antes de escribir, **incluida `inputs/`**, donde vive la copia del key visual y de los elementos del evento. Al regenerar, el evento perdía sus gráficos de IA. Ahora se genera en una carpeta aparte y al final se reemplazan **solo las carpetas de piezas**. Además, las piezas anteriores siguen visibles mientras se regenera. Los eventos de prueba que ya habían perdido `inputs/` se regeneran sin key visual.

## Decisiones

D36 (operaciones tipadas), D37 (parches por alcance), D38 (regeneración sin borrar `inputs/`).
