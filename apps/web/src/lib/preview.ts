import "server-only";
import { join } from "node:path";
import {
  agendaSlide,
  badge,
  buildKit,
  linkedinPost,
  resolveAssets,
  type KitInput,
  type RenderContext,
} from "@flock/templates";
import { REPO_ROOT } from "./paths";

export type PreviewPiece = "linkedin" | "badge" | "slide";

/** HTML de una pieza de muestra con assets por URL: liviano, para iframes de vista previa. */
export async function previewHtml(input: KitInput, piece: PreviewPiece, keyVisualUrl?: string) {
  const kit = buildKit(input);
  const ctx: RenderContext = {
    kit,
    assets: await resolveAssets(kit, {
      kind: "linked",
      brandDir: join(REPO_ROOT, "brand"),
      brandUrl: (file) => `/api/brand/${file}`,
      fontUrl: (family, subset) => `/api/fonts/${encodeURIComponent(family)}/${subset}`,
      keyVisualUrl,
    }),
  };
  const es = kit.event.language === "es";
  switch (piece) {
    case "badge":
      return badge.render(ctx, { firstName: es ? "Sofía" : "Sophie", lastName: es ? "González" : "Miller", role: es ? "Diseño UX" : "UX Design", area: "Design" });
    case "slide":
      return agendaSlide.render(ctx, { start: "9:30", end: "10:30", title: es ? "Charla de apertura" : "Opening talk" });
    default:
      return linkedinPost.render(ctx, { id: "anuncio", headline: kit.event.name, body: kit.event.description, post: "" }, "square");
  }
}
