import "server-only";
import { readFile } from "node:fs/promises";

/**
 * LinkedIn: Posts API con un token OAuth de una app de LinkedIn.
 * - Página de Flock: permiso w_organization_social y LINKEDIN_AUTHOR_URN=urn:li:organization:<id>
 * - Perfil personal: permiso w_member_social y LINKEDIN_AUTHOR_URN=urn:li:person:<id>
 * Variables: LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN, opcional LINKEDIN_VERSION (YYYYMM).
 */
export const linkedinStatus = () => ({
  connected: Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN),
  author: process.env.LINKEDIN_AUTHOR_URN ?? null,
});

const headers = () => ({
  Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
  "LinkedIn-Version": process.env.LINKEDIN_VERSION ?? "202509",
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});

/**
 * El texto de los posts usa el formato "little text" de LinkedIn: hay que escapar los caracteres
 * reservados, y los hashtags van como {hashtag|\#|tag} para que sigan siendo links.
 */
export function toLittleText(text: string) {
  const escaped = text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  return escaped.replace(/\\#([\p{L}\p{N}_]+)/gu, (_, tag) => `{hashtag|\\#|${tag}}`);
}

export async function publishToLinkedIn({ file, text, alt }: { file: string; text: string; alt: string }) {
  const { connected } = linkedinStatus();
  if (!connected) throw new Error("LinkedIn no está conectado (faltan LINKEDIN_ACCESS_TOKEN y LINKEDIN_AUTHOR_URN)");
  const author = process.env.LINKEDIN_AUTHOR_URN!;

  // 1. Registrar la imagen y subirla
  const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!init.ok) throw new Error(`LinkedIn: no se pudo registrar la imagen (${init.status} ${await init.text()})`);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}` },
    body: new Uint8Array(await readFile(file)),
    signal: AbortSignal.timeout(60_000),
  });
  if (!put.ok) throw new Error(`LinkedIn: la subida de la imagen falló (${put.status})`);

  // 2. Crear el post
  const post = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      author,
      commentary: toLittleText(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: value.image, altText: alt } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!post.ok) throw new Error(`LinkedIn: no se pudo publicar (${post.status} ${await post.text()})`);
  const urn = post.headers.get("x-restli-id");
  return { url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
}
