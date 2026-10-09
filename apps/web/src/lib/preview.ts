import "server-only";
import { join } from "node:path";
import {
  agendaSlide,
  badge,
  buildKit,
  linkedinPost,
  renderDesigned,
  resolveAssets,
  sampleData,
  type DesignedTemplate,
  type KitInput,
  type RenderContext,
} from "@flock/templates";
import { REPO_ROOT } from "./paths";

export type PreviewPiece = "linkedin" | "badge" | "slide";

/** HTML de una pieza de muestra con assets por URL: liviano, para iframes de vista previa. */
export async function previewHtml(
  input: KitInput,
  piece: PreviewPiece,
  keyVisualUrl?: string,
  elementUrls?: string[],
  designed?: Partial<Record<string, DesignedTemplate>>,
) {
  const kit = buildKit(input);
  // Plantilla diseñada por IA para esta pieza: se completa con los datos del formulario
  const template = designed?.[piece === "slide" ? "agenda-slide" : piece === "linkedin" ? "linkedin-square" : ""];
  if (template) {
    const tKit = { ...kit, style: { ...kit.style, fonts: { display: template.display, body: template.body } } };
    const assets = await resolveAssets(tKit, {
      kind: "linked",
      brandDir: join(REPO_ROOT, "brand"),
      brandUrl: (file) => `/api/brand/${file}`,
      fontUrl: (family, subset) => `/api/fonts/${encodeURIComponent(family)}/${subset}`,
    });
    const data = sampleData(template.piece);
    Object.assign(data, {
      EVENT_NAME: kit.event.name,
      DATE: kit.event.dateLabel,
      HASHTAG: kit.event.hashtag,
      LOCATION: kit.event.location ?? data.LOCATION,
      ...(kit.event.description ? { BODY: kit.event.description } : {}),
    });
    return renderDesigned(template, data, assets);
  }
  const ctx: RenderContext = {
    kit,
    assets: await resolveAssets(kit, {
      kind: "linked",
      brandDir: join(REPO_ROOT, "brand"),
      brandUrl: (file) => `/api/brand/${file}`,
      fontUrl: (family, subset) => `/api/fonts/${encodeURIComponent(family)}/${subset}`,
      keyVisualUrl,
      elementUrls,
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
