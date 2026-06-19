import { parseInlineStyle } from "@/lib/svgImport/parseStyles";
import type { SvgElement } from "@/lib/svgImport/parseSvg";
import { parseLength } from "@/lib/svgImport/svgMatrix";
import { warnDiag } from "@/lib/svgImport/svgImportDiagnostics";
import type { Matrix2D } from "@/lib/transformMath";

type TextPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type TextPaint = import("@/lib/svgImport/parseStyles").PaintState;

type TextImportCtx = {
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>;
  childOrder: Record<string, string[]>;
  diag: import("@/lib/svgImport/svgImportDiagnostics").SvgImportDiagnostics;
};

type TextDeps<Ctx extends TextImportCtx = TextImportCtx> = {
  nextId: (ctx: Ctx, prefix: string) => string;
  appendChild: (ctx: Ctx, parentId: string, childId: string) => void;
  baseNode: (
    id: string,
    parentId: string,
    type: "text",
    name: string,
    placement: TextPlacement,
    paint: TextPaint,
  ) => import("@/stores/useEditorStore").EditorNode;
  worldToParentLocal: (
    worldMatrix: Matrix2D,
    placementParentWorldM: Matrix2D,
    geomX: number,
    geomY: number,
    geomW: number,
    geomH: number,
  ) => TextPlacement;
  layerName: (el: SvgElement, fallback: string) => string;
};

function readFontSize(el: SvgElement, fallback: number): number {
  const style = parseInlineStyle(el.getAttr("style"));
  return parseLength(el.getAttr("font-size") ?? style["font-size"], fallback);
}

function readTextContent(el: SvgElement): string {
  const direct = el.directText();
  if (direct.trim()) return direct.trim();
  const parts: string[] = [];
  for (const child of el.childElements()) {
    if (child.tagLower === "tspan") {
      const t = child.directText();
      if (t) parts.push(t);
    }
  }
  return parts.join("").trim();
}

function tspanRuns(el: SvgElement): SvgElement[] {
  return el.childElements().filter((c) => c.tagLower === "tspan");
}

export function convertSvgTextElement<Ctx extends TextImportCtx>(
  el: SvgElement,
  parentId: string,
  worldM: Matrix2D,
  placementParentWorldM: Matrix2D,
  paintIn: TextPaint,
  ctx: Ctx,
  deps: TextDeps<Ctx>,
): void {
  const hasTextPath = el.childElements().some((c) => c.tagLower === "textpath");
  if (hasTextPath) {
    warnDiag(ctx.diag, "<textPath> positioning not supported — importing plain text only");
  }

  const baseFontSize = readFontSize(el, 16);
  const tspans = tspanRuns(el);

  if (tspans.length <= 1) {
    const content = readTextContent(el);
    if (!content) return;
    const tx = parseLength(el.getAttr("x"));
    const ty = parseLength(el.getAttr("y"));
    const fontSize = tspans[0] ? readFontSize(tspans[0]!, baseFontSize) : baseFontSize;
    const estW = Math.max(24, content.length * fontSize * 0.55);
    const estH = Math.max(16, fontSize * 1.2);
    const placement = deps.worldToParentLocal(worldM, placementParentWorldM, tx, ty - fontSize, estW, estH);
    const paint = paintIn;
    const id = deps.nextId(ctx, "svg-text");
    const node = deps.baseNode(id, parentId, "text", deps.layerName(el, "Text"), placement, paint);
    node.content = content;
    node.fontSize = fontSize;
    node.fontFamily = el.getAttr("font-family") ?? "Inter, sans-serif";
    node.textColor = paint.fill ?? "#000000";
    node.textAlign = "left";
    node.verticalAlign = "top";
    const style = parseInlineStyle(el.getAttr("style"));
    const fw = parseInt(el.getAttr("font-weight") ?? style["font-weight"] ?? "", 10);
    if (Number.isFinite(fw)) node.fontWeight = fw;
    ctx.nodes[id] = node;
    deps.appendChild(ctx, parentId, id);
    return;
  }

  const gid = deps.nextId(ctx, "svg-text-group");
  const groupPlacement = deps.worldToParentLocal(worldM, placementParentWorldM, 0, 0, 1, 1);
  ctx.nodes[gid] = {
    id: gid,
    parentId,
    type: "group",
    name: deps.layerName(el, "Text"),
    x: groupPlacement.x,
    y: groupPlacement.y,
    width: 1,
    height: 1,
    rotation: groupPlacement.rotation,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: false,
  };
  deps.appendChild(ctx, parentId, gid);

  let maxX = 0;
  let maxY = 0;
  for (const tspan of tspans) {
    const content = tspan.directText().trim();
    if (!content) continue;
    const fontSize = readFontSize(tspan, baseFontSize);
    const tx = parseLength(tspan.getAttr("x"), parseLength(el.getAttr("x")));
    const ty = parseLength(tspan.getAttr("y"), parseLength(el.getAttr("y")));
    const estW = Math.max(24, content.length * fontSize * 0.55);
    const estH = Math.max(16, fontSize * 1.2);
    const placement = deps.worldToParentLocal(worldM, worldM, tx, ty - fontSize, estW, estH);
    const id = deps.nextId(ctx, "svg-tspan");
    const node = deps.baseNode(id, gid, "text", "Tspan", placement, paintIn);
    node.content = content;
    node.fontSize = fontSize;
    node.fontFamily = tspan.getAttr("font-family") ?? el.getAttr("font-family") ?? "Inter, sans-serif";
    node.textColor = paintIn.fill ?? "#000000";
    node.textAlign = "left";
    node.verticalAlign = "top";
    ctx.nodes[id] = node;
    deps.appendChild(ctx, gid, id);
    maxX = Math.max(maxX, placement.x + estW);
    maxY = Math.max(maxY, placement.y + estH);
  }

  if ((ctx.childOrder[gid] ?? []).length === 0) {
    delete ctx.nodes[gid];
    ctx.childOrder[parentId] = (ctx.childOrder[parentId] ?? []).filter((id) => id !== gid);
    return;
  }

  ctx.nodes[gid] = {
    ...ctx.nodes[gid]!,
    width: Math.max(1, maxX),
    height: Math.max(1, maxY),
  };
}
