// Runtime JSX mínimo que convierte JSX directo en HTML (string), sin React.
// Las plantillas generan documentos estáticos: no hay estado ni hidratación, solo markup.
// Se usa con `@jsxImportSource @flock/templates` (ver package.json → exports "./jsx-runtime").

export class Html {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

type Child = Html | string | number | boolean | null | undefined | Child[];
type Props = Record<string, unknown> & { children?: Child };
type Component = (props: never) => Html | null;

export type CSSProperties = Record<string, string | number | undefined>;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const UNITLESS = new Set(["opacity", "zIndex", "fontWeight", "lineHeight", "flex", "flexGrow", "flexShrink", "order", "zoom"]);
const ATTR_ALIASES: Record<string, string> = { className: "class", htmlFor: "for", tabIndex: "tabindex" };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function css(style: CSSProperties) {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      const prop = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const value = typeof v === "number" && v !== 0 && !UNITLESS.has(k) ? `${v}px` : String(v);
      return `${prop}:${value}`;
    })
    .join(";");
}

function children(c: Child): string {
  if (c === null || c === undefined || c === false || c === true) return "";
  if (Array.isArray(c)) return c.map(children).join("");
  if (c instanceof Html) return c.value;
  return escape(String(c));
}

export function jsx(type: string | Component, props: Props): Html {
  if (typeof type === "function") return (type as (p: Props) => Html | null)(props) ?? new Html("");
  const { children: kids, dangerouslySetInnerHTML, ...rest } = props;
  let attrs = "";
  for (const [key, value] of Object.entries(rest)) {
    if (key === "key" || value === undefined || value === null || value === false) continue;
    const name = ATTR_ALIASES[key] ?? key;
    if (name === "style" && typeof value === "object") {
      const s = css(value as CSSProperties);
      if (s) attrs += ` style="${escape(s)}"`;
    } else if (value === true) attrs += ` ${name}`;
    else attrs += ` ${name}="${escape(String(value))}"`;
  }
  if (VOID.has(type)) return new Html(`<${type}${attrs}>`);
  const inner = (dangerouslySetInnerHTML as { __html: string } | undefined)?.__html ?? children(kids);
  return new Html(`<${type}${attrs}>${inner}</${type}>`);
}

export const jsxs = jsx;

export function Fragment({ children: kids }: { children?: Child }) {
  return new Html(children(kids));
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = Html;
  export interface IntrinsicElements {
    [tag: string]: Record<string, unknown>;
  }
  export interface ElementChildrenAttribute {
    children: object;
  }
}
