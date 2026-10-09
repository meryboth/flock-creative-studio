import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// El .env vive en la raíz del monorepo
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@flock/db", "@flock/studio", "@flock/agents", "@flock/renderer"],
  // Se cargan desde node_modules, sin empaquetar: paquetes nativos o con binarios, y las plantillas
  // (@flock/templates usa react-dom/server para generar HTML, que Next no permite dentro de la app)
  serverExternalPackages: ["@flock/templates", "postgres", "playwright", "playwright-core", "sharp", "node-vibrant", "@langchain/google-genai", "@langchain/core", "@imgly/background-removal-node", "onnxruntime-node"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
