import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeForExport } from "./collectSubtree";
import { ellipseArcJsxAttrs } from "@/lib/shapes/ellipseArcExport";
import { nodeToReactStyle, sanitizeComponentName, styleToLiteral } from "./reactStyle";
import {
  CODE_PAYLOAD_END,
  CODE_PAYLOAD_START,
  type CodeRoundTripPayloadV1,
} from "./types";

export type ReactExportInput = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds: string[];
  designTokens: Record<string, DesignToken>;
  assets: Record<string, EditorAsset>;
  fileName?: string;
  /** Preserved import block from initial React upload */
  sourceHeader?: string | null;
};

export type ReactExportResult = {
  source: string;
  componentName: string;
  exportRootIds: string[];
  payload: CodeRoundTripPayloadV1;
};

function pickExportRootIds(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const roots = childOrder[EDITOR_ROOT_KEY] ?? [];
  if (selectedIds.length > 0) {
    const tops = selectedIds.filter((id) => {
      const n = nodes[id];
      return n && n.visible !== false;
    });
    if (tops.length > 0) {
      const frame = tops.find((id) => {
        const t = nodes[id]?.type;
        return t === "frame" || t === "group";
      });
      if (frame) return [frame];
      return tops.slice(0, 1);
    }
  }
  const firstFrame = roots.find((id) => {
    const t = nodes[id]?.type;
    return t === "frame" || t === "group";
  });
  if (firstFrame) return [firstFrame];
  return roots.slice(0, 1);
}

function escapeJsxText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

export type JsxExportOptions = {
  /**
   * Paste-ready output: only built-in HTML elements (div, p, img, header, …).
   * Custom component tags (Header, BottomNav) become div + data-pc-component.
   */
  portable?: boolean;
  /** Screen frame is the code root at (0,0) — no canvas position on the frame */
  isFrameRoot?: boolean;
  /** Marks the exported screen frame element */
  isPcRoot?: boolean;
  pcRootId?: string;
};

function jsxTagForNode(node: EditorNode, opts?: JsxExportOptions): string {
  if (opts?.portable) {
    if (node.type === "text") return "p";
    if (node.type === "image") return "img";
    if (node.codeJsxTag && node.codeJsxIntrinsic && node.codeJsxTag !== "Fragment") {
      return node.codeJsxTag;
    }
    return "div";
  }
  if (node.codeJsxTag && node.codeJsxTag !== "Fragment" && !node.codeJsxIntrinsic) {
    return node.codeJsxTag;
  }
  if (node.type === "text") return "p";
  if (node.type === "image") return "img";
  return "div";
}

function portableComponentAttr(node: EditorNode, opts?: JsxExportOptions): string {
  if (!opts?.portable) return "";
  const tag = node.codeJsxTag;
  if (!tag || tag === "Fragment" || node.codeJsxIntrinsic) return "";
  return ` data-pc-component=${JSON.stringify(tag)}`;
}

export function nodeToJsx(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  designTokens: Record<string, DesignToken>,
  depth: number,
  opts?: JsxExportOptions,
): string {
  const pad = "  ".repeat(depth);
  const kids = childOrder[node.id] ?? [];
  const style = styleToLiteral(
    nodeToReactStyle(node, designTokens, { isFrameRoot: opts?.isFrameRoot }),
  );
  const rootAttr =
    opts?.isPcRoot && opts.pcRootId ? ` data-pc-root=${JSON.stringify(opts.pcRootId)}` : "";
  const nameAttr = ` data-pc-name=${JSON.stringify(node.name || node.type)}`;
  const idAttr = ` data-pc-id=${JSON.stringify(node.id)}`;
  const typeAttr = ` data-pc-type=${JSON.stringify(node.type)}`;
  const classAttr = node.codeClassName ? ` className=${JSON.stringify(node.codeClassName)}` : "";
  const componentAttr = portableComponentAttr(node, opts);
  const tag = jsxTagForNode(node, opts);

  if (node.type === "text" && tag === "p") {
    const text = escapeJsxText(node.content ?? "");
    return `${pad}<p${rootAttr}${typeAttr}${idAttr}${nameAttr}${classAttr}${componentAttr} style={${style}}>${text || "\u00a0"}</p>\n`;
  }

  if (node.type === "image" && tag === "img") {
    const src = node.imageSrc ? ` src=${JSON.stringify(node.imageSrc)}` : "";
    return `${pad}<img${rootAttr}${typeAttr}${idAttr}${nameAttr}${classAttr}${componentAttr}${src} style={${style}} alt="" />\n`;
  }

  if (
    node.type === "ellipse" ||
    node.type === "rectangle" ||
    node.type === "line" ||
    node.type === "arrow" ||
    node.type === "path"
  ) {
    return `${pad}<div${rootAttr}${typeAttr}${idAttr}${nameAttr}${classAttr}${componentAttr}${ellipseArcJsxAttrs(node)} data-pc-shape=${JSON.stringify(node.type)} style={${style}} />\n`;
  }

  const shapeAttr =
    node.type !== "frame" && node.type !== "group" && node.type !== "text" && node.type !== "image"
      ? ` data-pc-shape=${JSON.stringify(node.type)}`
      : "";

  if (kids.length === 0) {
    return `${pad}<${tag}${rootAttr}${typeAttr}${idAttr}${nameAttr}${classAttr}${componentAttr}${shapeAttr} style={${style}} />\n`;
  }
  const inner = kids
    .map((cid) => {
      const c = nodes[cid];
      const childOpts = opts?.isPcRoot ? (opts.portable ? { portable: true } : undefined) : opts;
      return c ? nodeToJsx(c, nodes, childOrder, designTokens, depth + 1, childOpts) : "";
    })
    .join("");
  return `${pad}<${tag}${rootAttr}${typeAttr}${idAttr}${nameAttr}${classAttr}${componentAttr}${shapeAttr} style={${style}}>\n${inner}${pad}</${tag}>\n`;
}

export function buildCodeRoundTripPayload(input: ReactExportInput): CodeRoundTripPayloadV1 {
  const exportRootIds = pickExportRootIds(input.selectedIds, input.nodes, input.childOrder);
  const { nodes, childOrder } = collectSubtreeForExport(
    exportRootIds,
    input.nodes,
    input.childOrder,
  );
  const rootNode = exportRootIds[0] ? nodes[exportRootIds[0]] : undefined;
  const componentName = sanitizeComponentName(rootNode?.name ?? input.fileName ?? "GeneratedScreen");

  return {
    version: 1,
    componentName,
    exportedAt: new Date().toISOString(),
    exportRootIds,
    nodes,
    childOrder,
    designTokens: input.designTokens,
    assets: input.assets,
    sourceHeader: input.sourceHeader ?? undefined,
  };
}

export function exportReactSource(input: ReactExportInput): ReactExportResult {
  const payload = buildCodeRoundTripPayload(input);
  const body = payload.exportRootIds
    .map((rid) => {
      const n = payload.nodes[rid];
      return n ? nodeToJsx(n, payload.nodes, payload.childOrder, payload.designTokens, 2) : "";
    })
    .join("");

  const payloadJson = JSON.stringify(payload, null, 2);

  const headerBlock = payload.sourceHeader ? `${payload.sourceHeader}\n\n` : "";
  const useClientBlock = payload.sourceHeader?.includes("use client")
    ? ""
    : `"use client";\n\nimport React from "react";\n\n`;

  const source = `/**
 * Paytm Craft — Design ↔ Code export
 * • Each layer has data-pc-id for 1:1 mapping with the canvas.
 * • Keep the @paytm-craft-payload block intact for lossless re-import.
 */

${CODE_PAYLOAD_START}
${payloadJson}
${CODE_PAYLOAD_END}

${headerBlock}${useClientBlock}export function ${payload.componentName}() {
  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100%" }}>
${body || "      {/* Empty */}\n"}
    </div>
  );
}

export default ${payload.componentName};
`;

  return {
    source,
    componentName: payload.componentName,
    exportRootIds: payload.exportRootIds,
    payload,
  };
}
