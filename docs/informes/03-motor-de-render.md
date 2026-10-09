# 03 · Motor de render

**Fecha:** 2026-10-09

## Qué se hizo

Un motor que convierte plantillas en piezas finales, validado reproduciendo las piezas reales del AI Day 2026 **sin IA**:

- **Plantillas en React** renderizadas a HTML estático, con los tokens del evento como variables CSS.
- **Playwright** (Chromium headless, una sola instancia reutilizada) captura PNG y genera PDF.
- Piezas: posteos de LinkedIn (cuadrado y apaisado + texto), una slide por bloque de agenda + resumen, credenciales a 300 dpi + PDF A4 de 3×3 con marcas de corte, certificados y landing en un único HTML autocontenido.
- Unas 40 piezas en 4 a 14 segundos.

## Decisiones

- **HTML/CSS + Playwright en lugar de Satori.** Las piezas de referencia usan blur, degradados radiales, mezcla de capas y tracking; Satori no los soporta bien. Además la landing usa el mismo motor.
- **Ajuste automático de texto (`data-fit`).** Un script dentro de la página achica la tipografía hasta que el texto entra en su caja, antes de la captura. Imprescindible con nombres largos y textos en dos idiomas. Las fuentes display sobresalen ~10% de su caja; el control de alto tiene esa tolerancia.
- **Todo embebido.** Fuentes e imágenes van como data URIs: la landing se puede mandar como un solo archivo.

## Contratiempos y aprendizajes

- **El key visual recortado de una pieza existente viene cortado.** La flor del AI Day estaba cortada contra el borde superior en la pieza original, y un recorte propio le sacó la punta a un pétalo. Se agregó una limpieza de franjas al recorte (`tools/cutout.ts`), pero la conclusión fue de fondo: no conviene depender de recortes de piezas ajenas.
- **Rotar un recorte deja ver el corte.** Regla: una imagen cortada solo se usa anclada al borde donde fue cortada.
- **La primera versión del ajuste de texto achicaba títulos que sí entraban**, por los ascendentes altos de la fuente display. Se corrigió con una tolerancia proporcional al tamaño.
