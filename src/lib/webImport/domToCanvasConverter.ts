import type { LayoutMode, PrimaryAxisAlign, CrossAxisAlign } from "@/lib/autoLayout";
import type {
  DomSnapshotNode,
  ImportWebSceneNode,
  ImportWebPageMeta,
} from "@/lib/webImport/types";
import { sanitizeImportText } from "@/lib/webImport/urlValidation";

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

function parsePx(v: string | undefined, fallback = 0): number {
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseColor(css: string | undefined): string | undefined {
  if (!css || css === "transparent" || css === "rgba(0, 0, 0, 0)") return undefined;
  return css;
}

function fontWeightNum(w: string | undefined): number {
  if (!w) return 400;
  const n = parseInt(w, 10);
  if (Number.isFinite(n)) return n;
  if (w === "bold") return 700;
  if (w === "bolder") return 700;
  if (w === "lighter") return 300;
  return 400;
}

const INPUT_TAGS = new Set(["input", "textarea", "select"]);
const INTRINSIC_TAGS = new Set([
  "div",
  "span",
  "p",
  "a",
  "button",
  "img",
  "section",
  "main",
  "article",
  "header",
  "footer",
  "nav",
  "form",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "input",
  "textarea",
  "select",
]);

function codeFieldsFromDom(node: DomSnapshotNode): Pick<
  ImportWebSceneNode,
  "codeClassName" | "codeJsxTag" | "codeJsxIntrinsic"
> {
  const tag = node.tagName.toLowerCase();
  const intrinsic = INTRINSIC_TAGS.has(tag);
  return {
    codeClassName: node.className,
    codeJsxTag: intrinsic ? tag : undefined,
    codeJsxIntrinsic: intrinsic ? true : undefined,
  };
}

function mapTextAlign(v: string | undefined): "left" | "center" | "right" {
  if (v === "center") return "center";
  if (v === "right" || v === "end") return "right";
  return "left";
}

function inferLayout(styles: DomSnapshotNode["styles"]): {
  layoutMode?: LayoutMode;
  layoutGap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
} {
  const display = (styles.display ?? "").toLowerCase();
  if (display !== "flex" && display !== "inline-flex") return {};
  const dir = (styles.flexDirection ?? "row").toLowerCase();
  const layoutMode: LayoutMode = dir.startsWith("column") ? "vertical" : "horizontal";
  const gap = parsePx(styles.gap, 0);
  const primaryAxisAlign: PrimaryAxisAlign =
    styles.justifyContent === "center"
      ? "center"
      : styles.justifyContent === "flex-end" || styles.justifyContent === "end"
        ? "end"
        : styles.justifyContent === "space-between"
          ? "space-between"
          : "start";
  const counterAxisAlign: CrossAxisAlign =
    styles.alignItems === "center"
      ? "center"
      : styles.alignItems === "flex-end" || styles.alignItems === "end"
        ? "end"
        : styles.alignItems === "stretch"
          ? "stretch"
          : "start";
  return {
    layoutMode,
    layoutGap: gap,
    paddingTop: parsePx(styles.paddingTop),
    paddingRight: parsePx(styles.paddingRight),
    paddingBottom: parsePx(styles.paddingBottom),
    paddingLeft: parsePx(styles.paddingLeft),
    primaryAxisAlign,
    counterAxisAlign,
  };
}

function nodeKindForDom(node: DomSnapshotNode): ImportWebSceneNode["type"] {
  const tag = node.tagName.toLowerCase();
  if (tag === "img") return "image";
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "a", "li", "button"].includes(tag)) {
    if (node.text && node.children.length === 0) return "text";
  }
  if (INPUT_TAGS.has(tag)) return "rectangle";
  if (tag === "svg") return "rectangle";
  if (node.componentHint === "button") return "frame";
  if (["section", "main", "article", "header", "footer", "nav", "form", "div"].includes(tag)) {
    return node.children.length > 0 ? "frame" : "rectangle";
  }
  return "rectangle";
}

function convertNode(
  node: DomSnapshotNode,
  parentX: number,
  parentY: number,
  assets: Record<string, { id: string; dataUrl: string; name: string; mimeType: string }>,
): ImportWebSceneNode {
  const localX = Math.max(0, node.rect.x - parentX);
  const localY = Math.max(0, node.rect.y - parentY);
  const w = Math.max(1, Math.round(node.rect.width));
  const h = Math.max(1, Math.round(node.rect.height));
  const layout = inferLayout(node.styles);
  const fill = parseColor(node.styles.backgroundColor);
  const type = nodeKindForDom(node);

  const base: ImportWebSceneNode = {
    id: nextId("web"),
    type,
    name: node.componentHint
      ? `${node.componentHint}`
      : node.sectionHint
        ? node.sectionHint
        : node.className?.split(/\s+/)[0] || node.tagName,
    x: localX,
    y: localY,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...codeFieldsFromDom(node),
    fill: fill ?? (type === "frame" ? "#ffffff" : type === "rectangle" ? fill : undefined),
    fillEnabled: type !== "text" ? Boolean(fill) || type === "frame" : false,
    fillOpacity: parseFloat(node.styles.opacity ?? "1") || 1,
    cornerRadius: parsePx(node.styles.borderRadius),
    ...layout,
    clipChildren: type === "frame" ? true : undefined,
  };

  if (type === "text" && node.text) {
    base.content = sanitizeImportText(node.text, 4000);
    const textFill = parseColor(node.styles.color) ?? "#111111";
    base.fontFamily = node.styles.fontFamily?.split(",")[0]?.replace(/['"]/g, "") ?? "Inter, sans-serif";
    base.fontSize = Math.max(8, Math.round(parsePx(node.styles.fontSize, 14)));
    base.fontWeight = fontWeightNum(node.styles.fontWeight);
    base.textAlign = mapTextAlign(node.styles.textAlign);
    base.fillEnabled = true;
    base.fill = textFill;
  }

  if (type === "image" && node.src) {
    const aid = nextId("asset");
    assets[aid] = {
      id: aid,
      dataUrl: node.src.startsWith("data:") ? node.src : node.src,
      name: node.ariaLabel || "Imported image",
      mimeType: "image/png",
    };
    base.assetId = aid;
    base.imageSrc = node.src;
  }

  const childParentX = node.rect.x;
  const childParentY = node.rect.y;
  const children = node.children.map((c) => convertNode(c, childParentX, childParentY, assets));
  if (children.length > 0) {
    base.children = children;
    if (base.type === "rectangle") base.type = "frame";
  }

  if (node.componentHint === "button" && node.text) {
    base.name = "Button";
    base.layoutMode = base.layoutMode ?? "horizontal";
    base.children = [
      {
        id: nextId("web"),
        type: "text",
        name: "Label",
        x: 12,
        y: Math.max(4, Math.round(h / 2 - 8)),
        width: Math.max(40, w - 24),
        height: 20,
        content: sanitizeImportText(node.text, 200),
        fontSize: Math.max(12, Math.round(parsePx(node.styles.fontSize, 14))),
        fontWeight: 600,
        textAlign: "center",
        fill: parseColor(node.styles.color) ?? "#ffffff",
        fillEnabled: true,
      },
    ];
  }

  if (INPUT_TAGS.has(node.tagName) && (node.placeholder || node.inputValue)) {
    base.name = "Input";
    base.children = [
      {
        id: nextId("web"),
        type: "text",
        name: "Placeholder",
        x: 8,
        y: Math.max(6, Math.round(h / 2 - 7)),
        width: Math.max(40, w - 16),
        height: 18,
        content: sanitizeImportText(node.placeholder || node.inputValue || "", 200),
        fontSize: 14,
        fill: "#6b7280",
        fillEnabled: true,
      },
    ];
  }

  return base;
}

export function domSnapshotToScene(
  root: DomSnapshotNode,
  page: ImportWebPageMeta,
): { scene: ImportWebSceneNode; assets: Record<string, { id: string; dataUrl: string; name: string; mimeType: string }> } {
  idSeq = 0;
  const assets: Record<string, { id: string; dataUrl: string; name: string; mimeType: string }> = {};
  const children = root.children.map((c) => convertNode(c, 0, 0, assets));

  const scene: ImportWebSceneNode = {
    id: nextId("web-root"),
    type: "frame",
    name: page.title || "Imported page",
    x: 0,
    y: 0,
    width: page.width,
    height: page.height,
    fillEnabled: false,
    clipChildren: true,
    layoutMode: "vertical",
    layoutGap: 0,
    children,
  };

  return { scene, assets };
}
