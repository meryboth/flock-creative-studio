# 09 · Key visuals locales con ComfyUI y biblioteca de estilos

**Fecha:** 2026-10-09

## Key visuals con ComfyUI (local)

Los modelos de imagen de Gemini no tienen cuota en el plan gratuito, así que se probó primero la alternativa local. **Funcionó.**

- **Modelo:** SDXL base 1.0 (Stability AI, licencia OpenRAIL++, apta para uso comercial), 6,9 GB, verificado con su SHA-256.
- **ComfyUI Desktop** guarda los modelos en `~/Documents`, una carpeta protegida por macOS para la terminal. El modelo quedó en `~/ComfyUI-Shared/models` y esa carpeta se registró en `extra_models_config.yaml`, con un respaldo de la configuración original.
- **Workflow versionado** en `comfy/workflows/keyvisual_sdxl.json` (formato API). La app lo encola por HTTP, espera el resultado y lo descarga.
- **Proveedores intercambiables** (`KEYVISUAL_PROVIDERS=comfyui,gemini`): si ComfyUI no está abierto se prueba con Gemini, y si los dos fallan el error dice qué pasó con cada uno.
- **Tiempo:** de 2,5 a 3 minutos por imagen de 1024×1024 en una M3 Pro.

### Lo que hubo que ajustar

1. **Composición:** el primer prompt devolvió una textura que llenaba todo el cuadro. Los modelos de difusión le dan más peso al principio del texto, así que la composición ("un objeto aislado, centrado, con aire alrededor") pasó adelante.
2. **Fondo:** SDXL no entiende colores hexadecimales. Se agregó un traductor de color a palabras ("very dark navy blue"). Igual, el modelo no respetó el fondo pedido y agregó un pedestal (por la palabra "studio").
3. **Recorte local:** la solución robusta fue no depender del fondo. Cada imagen generada se **recorta automáticamente** (ONNX, local) y el objeto se apoya, con transparencia, sobre el fondo real del estilo. Si el recorte falla, se usa la imagen igual, para no perder minutos de generación.

**Resultado:** a partir del certificado del AI Day, el sistema generó una esfera iridiscente original y la compuso en el cronograma, el posteo y la credencial, con una estética muy cercana a la de la agencia, sin copiarla.

## Biblioteca de estilos

El equipo puede **dar de alta estilos a partir de referencias** sin tener un evento concreto, ver cómo se aplican y borrar los que ya no usa.

- `/estilos`: los estilos del equipo y los 4 del catálogo, con vista previa.
- `/estilos/nuevo`: se suben referencias, el modelo de visión las lee, opcionalmente se genera un key visual, y el estilo se guarda con un nombre.
- `/estilos/[id]`: ficha con las referencias, "lo que vimos", ejemplos aplicados (cronograma, posteo y credencial con un evento de muestra), en cuántos eventos se usó, "Usar en un evento" y "Borrar estilo" (con confirmación).
- En "Nuevo evento", los estilos del equipo aparecen junto a los del catálogo.

**Decisión clave:** cada evento guarda su **propia copia** del estilo y del key visual al crearse. Borrar un estilo de la biblioteca no afecta a los eventos que ya lo usaron. Se probó de punta a punta: crear, ver los ejemplos, borrar (base de datos y archivos), y el resto de la biblioteca queda intacto.

## Ajustes de la app

- El fondo pasó a ser una **plancha de corte verde**, con grilla fina, líneas marcadas cada 5 cuadros y números de regla, según una referencia de la usuaria.
- El pie dice "hecho por Marilyn Botheatoz en el Flock AI Day", con link.
- **Repositorio público** en GitHub. Quedan afuera las piezas de la agencia, el material interno y los nombres reales.
