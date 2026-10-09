# 17 · Plantillas diseñadas por IA

**Fecha:** 2026-10-09

## Por qué

Con una referencia como la de Uniqode (grilla de tarjetas, letras de puntos, ilustraciones en punto cruz, microtextos), el resultado seguía siendo genérico. El sistema solo podía combinar un catálogo cerrado (3 composiciones, 28 fuentes, motivos de código), y cada referencia nueva traía algo que no estaba en el catálogo. Ampliarlo cada vez siempre llegaba tarde.

## Enfoque

Un **agente diseñador** mira la referencia y escribe la plantilla HTML/CSS de cada pieza principal:

- posteo cuadrado;
- posteo apaisado (también Slack);
- slide del cronograma;
- cronograma completo.

El código pone las reglas, las valida y completa la plantilla con los datos reales. La plantilla se diseña **una vez por estilo** y queda fija, así que los resultados son reproducibles.

### Reglas fijas, validadas por código (`packages/templates/src/designed.ts`)

- Variables para cada dato (`{{EVENT_NAME}}`, `{{DATE}}`, `{{START}}`…), completadas con escape de HTML.
- Logo de Flock en sus dos versiones (`{{LOGO_COLOR}}` / `{{LOGO_WHITE}}`), según el fondo.
- Solo fuentes del catálogo.
- Paleta en variables CSS (`--ground`, `--ink`, `--accent`…) y título con `var(--title-scale)`, para que el chat de edición siga funcionando.
- Clases obligatorias (`event-name`, `hashtag`, `date`).
- Saneamiento: sin scripts, sin manejadores de eventos, sin recursos externos.
- Microtextos: solo etiquetas cortas en español; los textos técnicos o de relleno ("SYS_ACTIVE", "FLOCK ART") se rechazan.
- Cuerpo mínimo de lo que tiene que dominar (el nombre en los posteos, la hora y el título en la slide), medido en el render con los datos más largos.

### Lazo de revisión (`packages/studio/src/design.ts`)

1. **Dos propuestas en paralelo**: la composición obvia y una alternativa.
2. Cada propuesta pasa por los controles:
   - reglas fijas;
   - render con los datos más largos;
   - control geométrico (textos recortados);
   - verificador de lectura;
   - detector de Impeccable (contraste, jerarquía);
   - **revisor** contra la referencia (fidelidad, calidad y si copió contenido).
3. La mejor pasa a las **revisiones** (`DESIGN_ROUNDS`, 2 por defecto). Cada problema vuelve como corrección concreta y queda la versión mejor puntuada.

### En la app

- **"Diseñar plantillas con IA"** en el panel de la referencia (nuevo evento y nuevo estilo): avance por pieza, miniaturas al terminar y vista previa con las plantillas. Tarda unos 3 a 4 minutos.
- Las plantillas se guardan con el estilo de la biblioteca y con el evento (copia propia), y la generación las usa en esas piezas. Credenciales, certificados y landing siguen con las plantillas de código.
- **Chat:** con plantillas diseñadas, los cambios de composición, ilustración o tipografía se hacen con la operación nueva **`redesign`**. El chat le pasa la instrucción al diseñador para las piezas del alcance elegido, en unos 2 minutos. Colores, tamaño del título y ocultar elementos siguen funcionando como antes.
- `pnpm design:templates <imagen>` hace lo mismo desde la terminal.

## Resultados

- **Uniqode:** grilla de tarjetas, paleta cobalto / negro / periwinkle, letra pixel, ilustraciones en punto cruz propias (bandada, pájaros), microtextos en español, logo blanco sobre azul. En la generación del evento, el verificador no encontró problemas en las 7 piezas que leyó.
- **Chat:** el pedido "cambiá el ícono de las cruces por una bandada en punto cruz, más grande" rediseñó el posteo cuadrado, con el nombre más grande y una bandada bordada.

## Lo que falta

- **Calidad variable entre corridas.** Una pieza puede salir muy bien en un intento y mediocre en otro. Las dos propuestas iniciales ayudan, pero el revisor puntúa entre 6 y 8. Próximo paso: mostrar 2 o 3 candidatas por pieza y dejar que la persona elija.
- **Tensiones entre reglas.** "Nombre grande" contra "nombres de hasta 34 caracteres sin cortarse" hace que algunas revisiones empeoren; queda la mejor versión.
- **Costo y tiempo.** Diseñar un estilo completo hace unas 30 llamadas a Claude (diseñador, revisor y verificador). Se registran en `llm_calls`, por tarea, y se ven en Métricas.
- **Sin eval propia.** Las plantillas diseñadas todavía no tienen suite en `pnpm evals`.

## Decisiones

D60.
