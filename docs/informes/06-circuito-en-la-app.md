# 06 · El circuito en la app: evento → estilo → familia

**Fecha:** 2026-10-09

## Qué se hizo

El circuito central ya funciona de punta a punta en la app:

1. **Nuevo evento** (`/eventos/nuevo`): nombre, fecha, idioma (es/en), lugar, descripción, hashtag y frase opcionales, y la agenda (un bloque por línea).
2. **Estilo:** catálogo de 4 estilos con **vistas previas en vivo**, que se actualizan con lo que la persona va escribiendo. Moodboard opcional: se suben imágenes, se extraen sus colores y se sugiere un estilo. Selector de colores (salvo en el estilo Flock, que usa los institucionales) y botón "Otra variante" (cambia la semilla).
3. **Generación en segundo plano:** al enviar, la app redirige a la página del evento, que muestra el progreso (redacción con Gemini → piezas) y se refresca sola.
4. **Familia de piezas:** galería por tipo, con el texto de cada posteo listo para copiar. Acciones: "Otra variante" (regenera sin volver a redactar) y "Reescribir textos".

Prueba real: "Flock Outdoor 2027", estilo Orgánico → 41 piezas (posteos, cronograma, credenciales, certificados, landing) con textos de Gemini y QA de diseño sin hallazgos.

## Decisiones y contratiempos

- **`after()` de Next.js para el trabajo en segundo plano.** Corre después de responder (incluso después de un `redirect`) y, en un servidor propio, sin límite de duración. El progreso queda en la tabla `runs`. Para una sola Mac alcanza; con varias personas generando a la vez conviene una cola (pg-boss), como estaba en la propuesta original.
- **Las plantillas dejaron de usar React.** Next.js no permite importar `react-dom/server` dentro de la app, y las plantillas lo usaban para convertir JSX en HTML. Probamos tres caminos:
  1. Externalizar el paquete: Turbopack igual empaqueta los paquetes del monorepo.
  2. Compilarlo a `dist/`: el chequeo de Next también aplica sobre el JS compilado.
  3. **Un runtime JSX propio** de unas 60 líneas, que convierte JSX directo en HTML. Las plantillas no cambiaron, el resultado es idéntico píxel a píxel y el motor de render quedó sin dependencias de React.
- **Vistas previas livianas:** las piezas finales embeben fuentes e imágenes (data URIs). Las vistas previas, en cambio, piden fuentes y logos por URL a la app, así el HTML pesa unos pocos KB y se recalcula al tipear.
- **Gemini puede fallar:** en la primera generación ningún modelo respondió a tiempo y se usaron los textos base; al reintentar ("Reescribir textos"), respondió bien. El error ahora queda registrado y visible.
- **Asistentes fuera del formulario.** Definir un evento no requiere la lista de personas. Las credenciales y certificados usan por ahora una **nómina de ejemplo** con nombres ficticios, y la página lo avisa (ver informe 07).

## Pendientes

- En el estilo Orgánico, la serif dibujaba mal horarios y `#`: corregido con un ajuste CSS propio del estilo.
- Descargar toda la familia en un ZIP.
- Editor conversacional (§11 de la propuesta).
