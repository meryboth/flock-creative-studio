import { resolve } from "node:path";

export const REPO_ROOT = resolve(process.cwd(), "../..");
export const BRAND_DIR = resolve(REPO_ROOT, "brand");
export const STORAGE_DIR = resolve(REPO_ROOT, "storage");
export const UPLOADS_DIR = resolve(STORAGE_DIR, "uploads");
