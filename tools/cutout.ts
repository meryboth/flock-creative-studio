// Recorta un objeto de una imagen y le quita el fondo (local, ONNX).
// Uso: tsx cutout.ts <entrada> <salida.png> [left,top,width,height] [--erase-neutral y0-y1]
//   --erase-neutral: borra píxeles blancos/grises en esa franja horizontal (coordenadas del recorte),
//   para quitar líneas de la pieza original que quedan pegadas al objeto (ej. el borde de un recuadro).
import { removeBackground } from "@imgly/background-removal-node";
import sharp from "sharp";

const args = process.argv.slice(2);
const flag = args.indexOf("--erase-neutral");
const eraseBand = flag >= 0 ? args.splice(flag, 2)[1].split("-").map(Number) : null;
const [input, output, crop] = args;
if (!input || !output) {
  console.error("Uso: tsx cutout.ts <entrada> <salida.png> [left,top,width,height]");
  process.exit(1);
}

let img = sharp(input);
if (crop) {
  const [left, top, width, height] = crop.split(",").map(Number);
  img = img.extract({ left, top, width, height });
}
const png = await img.png().toBuffer();

const blob = await removeBackground(new Blob([new Uint8Array(png)], { type: "image/png" }), {
  model: "medium",
  output: { format: "image/png", quality: 1 },
});
let cut = Buffer.from(await blob.arrayBuffer());

if (eraseBand) {
  const [y0, y1] = eraseBand;
  const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let erased = 0;
  for (let y = y0; y <= Math.min(y1, info.height - 1); y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(r, g, b);
      const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
      // la línea queda blanca, gris o gris azulada oscura; el objeto es brillante y saturado
      if (data[i + 3] > 0 && (saturation < 0.2 || max < 90)) (data[i + 3] = 0), erased++;
    }
  cut = await sharp(data, { raw: info }).png().toBuffer();
  console.log(`  franja ${y0}-${y1}: ${erased} píxeles neutros borrados`);
}

// Limpiar el halo casi transparente que deja el fondo original alrededor del objeto
{
  const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] < 40) data[i] = 0;
  cut = await sharp(data, { raw: info }).png().toBuffer();
}

// Recortar el borde transparente sobrante
await sharp(cut).trim({ threshold: 1 }).png().toFile(output);
const meta = await sharp(output).metadata();
console.log(`✓ ${output} (${meta.width}×${meta.height})`);
