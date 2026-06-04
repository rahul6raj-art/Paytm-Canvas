import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";
import { nodeToReactStyle, type ReactStyleRecord } from "@/lib/codeRoundTrip/reactStyle";
import {
  PC_COMPONENT_ATTR,
  PC_ID_ATTR,
  PC_NAME_ATTR,
  PC_ROOT_ATTR,
  PC_SHAPE_ATTR,
  PC_TYPE_ATTR,
} from "./pcMetadata";
import type { CodeStyleOptions } from "@/lib/codeRoundTrip/reactStyle";
import { ellipseArcPcAttrParts } from "@/lib/shapes/ellipseArcExport";
import {
  booleanGroupExportSvgMarkup,
  codeExportChildIds,
  compositeGroupHtmlAttrParts,
  maskGroupClipDefsMarkup,
} from "@/lib/codeExport/compositeShapeExport";
import { isBooleanGroup, isMaskGroup } from "@/lib/booleanGeometry";

export type HtmlExportOptions = {
  isFrameRoot?: boolean;
  isPcRoot?: boolean;
  pcRootId?: string;
};

const UNITLESS_PROPS = new Set([
  "opacity",
  "fontWeight",
  "lineHeight",
  "zIndex",
  "flexGrow",
  "flexShrink",
  "flex",
]);

function camelToKebab(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export function reactStyleToInlineCss(style: ReactStyleRecord): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([key, value]) => {
      const prop = camelToKebab(key);
      const val =
        typeof value === "number" && !UNITLESS_PROPS.has(key) ? `${value}px` : String(value);
      return `${prop}: ${val}`;
    })
    .join("; ");
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(text: string): string {
  return escapeHtmlText(text).replace(/'/g, "&#39;");
}

function htmlTagForNode(node: EditorNode): string {
  if (node.codeJsxTag && node.codeJsxIntrinsic && node.codeJsxTag !== "Fragment") {
    return node.codeJsxTag;
  }
  if (node.type === "text") return "p";
  if (node.type === "image") return "img";
  return "div";
}

function htmlComponentAttr(node: EditorNode): string {
  const tag = node.codeJsxTag;
  if (!tag || tag === "Fragment" || node.codeJsxIntrinsic) return "";
  return `${PC_COMPONENT_ATTR}="${escapeHtmlAttr(tag)}" `;
}

function attrsForNode(node: EditorNode, styleCss: string, opts?: HtmlExportOptions): string {
  const parts = [
    htmlComponentAttr(node),
    opts?.isPcRoot && opts.pcRootId ? `${PC_ROOT_ATTR}="${escapeHtmlAttr(opts.pcRootId)}"` : "",
    `${PC_TYPE_ATTR}="${escapeHtmlAttr(node.type)}"`,
    `${PC_ID_ATTR}="${escapeHtmlAttr(node.id)}"`,
    `${PC_NAME_ATTR}="${escapeHtmlAttr(node.name || node.type)}"`,
  ].filter(Boolean);
  if (node.codeClassName) {
    parts.push(`class="${escapeHtmlAttr(node.codeClassName)}"`);
  }
  if (styleCss) parts.push(`style="${escapeHtmlAttr(styleCss)}"`);
  if (
    node.type === "rectangle" ||
    node.type === "ellipse" ||
    node.type === "line" ||
    node.type === "arrow" ||
    node.type === "path"
  ) {
    parts.push(`${PC_SHAPE_ATTR}="${escapeHtmlAttr(node.type)}"`);
  }
  if (node.type === "ellipse") {
    for (const arcAttr of ellipseArcPcAttrParts(node)) {
      parts.push(arcAttr);
    }
  }
  for (const attr of compositeGroupHtmlAttrParts(node)) {
    parts.push(attr);
  }
  return parts.join(" ");
}

export function nodeToHtml(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  designTokens: Record<string, DesignToken>,
  depth: number,
  opts?: HtmlExportOptions,
): string {
  const pad = "  ".repeat(depth);
  const kids = codeExportChildIds(node, childOrder);
  const codeStyle: CodeStyleOptions = {
    isFrameRoot: opts?.isFrameRoot,
    nodes,
    childOrder,
  };
  const styleCss = reactStyleToInlineCss(nodeToReactStyle(node, designTokens, codeStyle));
  const attrs = attrsForNode(node, styleCss, opts);
  const tag = htmlTagForNode(node);

  if (node.type === "text" && tag === "p") {
    const text = escapeHtmlText(node.content ?? "") || "&nbsp;";
    return `${pad}<p ${attrs}>${text}</p>\n`;
  }

  if (node.type === "image" && tag === "img") {
    const src = node.imageSrc ? ` src="${escapeHtmlAttr(node.imageSrc)}"` : "";
    return `${pad}<img ${attrs}${src} alt="" />\n`;
  }

  if (
    node.type === "ellipse" ||
    node.type === "rectangle" ||
    node.type === "line" ||
    node.type === "arrow" ||
    node.type === "path"
  ) {
    return `${pad}<div ${attrs}></div>\n`;
  }

  if (isBooleanGroup(node)) {
    const svg = booleanGroupExportSvgMarkup(node, nodes, childOrder);
    return `${pad}<div ${attrs}>${svg}</div>\n`;
  }

  if (isMaskGroup(node)) {
    const clip = maskGroupClipDefsMarkup(node, nodes, childOrder);
    const inner = kids
      .map((cid) => {
        const c = nodes[cid];
        const childOpts = opts?.isPcRoot ? undefined : opts;
        return c ? nodeToHtml(c, nodes, childOrder, designTokens, depth + 2, childOpts) : "";
      })
      .join("");
    const clipStyle = clip
      ? `position: relative; width: 100%; height: 100%; clip-path: ${clip.clipRef}`
      : "position: relative; width: 100%; height: 100%";
    return `${pad}<div ${attrs}>\n${clip ? `${pad}  ${clip.defsMarkup}\n` : ""}${pad}  <div style="${escapeHtmlAttr(clipStyle)}">\n${inner}${pad}  </div>\n${pad}</div>\n`;
  }

  if (kids.length === 0) {
    return `${pad}<${tag} ${attrs}></${tag}>\n`;
  }

  const inner = kids
    .map((cid) => {
      const c = nodes[cid];
      const childOpts = opts?.isPcRoot ? undefined : opts;
      return c ? nodeToHtml(c, nodes, childOrder, designTokens, depth + 1, childOpts) : "";
    })
    .join("");

  return `${pad}<${tag} ${attrs}>\n${inner}${pad}</${tag}>\n`;
}
