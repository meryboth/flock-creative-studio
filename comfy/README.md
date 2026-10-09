# ComfyUI

Workflows (formato API) que usa Flock Creative Studio para generar key visuals en local.

- `workflows/keyvisual_sdxl.json`: texto → imagen con SDXL base 1.0 (1024×1024). Las variables `{{checkpoint}}`, `{{prompt}}`, `{{negative}}` y `{{seed}}` las completa `packages/agents/src/keyvisual.ts`.

## Puesta en marcha

1. Modelo: `~/ComfyUI-Shared/models/checkpoints/sd_xl_base_1.0.safetensors` (Stability AI, licencia CreativeML OpenRAIL++-M).
2. Esa carpeta está registrada en `~/Library/Application Support/ComfyUI/extra_models_config.yaml` (bloque `flock_shared`).
3. Abrir **Comfy Desktop** (servidor en `http://127.0.0.1:8000`). La URL se configura con `COMFYUI_URL` en `.env`.

ComfyUI es el **respaldo local**: el proveedor principal es Gemini Image (`KEYVISUAL_PROVIDERS=gemini,comfyui`), que recibe la referencia como imagen, sigue mejor las instrucciones y tarda ~12 s. Si Gemini falla o se queda sin saldo, la app usa ComfyUI.
