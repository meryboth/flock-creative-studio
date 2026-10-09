# 04 · Calidad de diseño con Impeccable

**Fecha:** 2026-10-09

## Qué se hizo

- Se instaló la skill **[Impeccable](https://impeccable.style)** (Apache-2.0) a nivel proyecto, fijada en `skills-lock.json`. Guía al agente de código con criterios de diseño y trae un detector de anti-patrones (59 reglas).
- Antes de usarla se revisó el lanzador: descarga el motor desde los releases oficiales de GitHub y **verifica su SHA-256**; si no puede verificarlo, no lo ejecuta. (El instalador marcó una alerta de Socket y riesgo medio en Snyk por esa descarga.)
- `PRODUCT.md` en la raíz con la verdad del producto (usuarios, éxito, requisitos WCAG AA, español e inglés, reglas de marca), que la skill lee antes de cualquier trabajo de diseño.
- **El detector corre en cada generación de piezas:** se pasa por una pieza de cada plantilla y el reporte queda en `storage/<evento>/qa/report.txt`. Informa; no frena la generación.

## Cómo se tratan los hallazgos

| Tipo | Ejemplo | Tratamiento |
|---|---|---|
| Problema real | títulos que saltan de `h1` a `h3`; filas de alto fijo que no crecen con textos largos | se corrige |
| Falso positivo | "texto pegado al borde" porque el visual sangra fuera del lienzo a propósito | se corrige la causa (el fondo pasa al `body`), sin cambio visual |
| Excepción de oficio | interlineado ajustado en titulares display; brillo radial en el estilo Iridiscente | excepción explícita y acotada, con el motivo escrito en el código |

## Lo que el detector no ve

El "piso de calidad" de la skill prohíbe, entre otras cosas, los rótulos chicos encima de los títulos y las grillas de tarjetas iguales. Ambos aparecían en las primeras plantillas y se sacaron al rehacerlas para el sistema de estilos.
