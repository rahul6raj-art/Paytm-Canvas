import type { BooleanOperation } from "@/lib/booleanGeometry";
import {
  normalizePathNode,
  newPathPointId,
  pathBounds,
  svgPathDToPathPoints,
  type PathPoint,
} from "@/lib/pathGeometry";
import { DEFAULT_SHAPE_FILL } from "@/lib/shapes/shapeModel";
import type { EditorNode } from "@/stores/useEditorStore";
import type { HtmlImportElement } from "./htmlParseTree";

type SvgPathRow = { d: string; fill?: string; mask?: string };

function isHexFill(fill: string | undefined): boolean {
  if (!fill) return false;
  const f = fill.trim().toLowerCase();
  if (f === "none" || f === "transparent") return false;
  return f.startsWith("#") || f.startsWith("rgb");
}

function parsePathTagsFromMarkup(markup: string): SvgPathRow[] {
  const rows: SvgPathRow[] = [];
  const re = /<path\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) {
    const attrs = m[1] ?? "";
    const d =
      /(?:^|\s)d\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ??
      /(?:^|\s)d\s*=\s*'([^']*)'/i.exec(attrs)?.[1];
    if (!d) continue;
    const fill =
      /(?:^|\s)fill\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ??
      /(?:^|\s)fill\s*=\s*'([^']*)'/i.exec(attrs)?.[1];
    const mask =
      /(?:^|\s)mask\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ??
      /(?:^|\s)mask\s*=\s*'([^']*)'/i.exec(attrs)?.[1];
    rows.push({ d, fill, mask });
  }
  return rows;
}

function collectPathRows(el: HtmlImportElement): SvgPathRow[] {
  const fromQuery = el.querySelectorAll("path").map((p) => ({
    d: p.getAttr("d") ?? "",
    fill: p.getAttr("fill"),
    mask: p.getAttr("mask"),
  })).filter((r) => r.d.length > 0);

  if (fromQuery.length > 0) return fromQuery;

  const walkRows: SvgPathRow[] = [];
  const walk = (node: HtmlImportElement) => {
    if (node.tagLower === "path") {
      const d = node.getAttr("d");
      if (d) {
        walkRows.push({
          d,
          fill: node.getAttr("fill"),
          mask: node.getAttr("mask"),
        });
      }
    }
    for (const ch of node.childElements()) walk(ch);
  };
  walk(el);
  if (walkRows.length > 0) return walkRows;

  const markup = el.innerMarkup();
  if (markup.trim()) return parsePathTagsFromMarkup(markup);

  return [];
}

function operandsFromPathRows(
  all: SvgPathRow[],
  operation: BooleanOperation,
): { operandDs: string[]; fill: string } | null {

  if (operation === "subtract") {
    const base = all.find((p) => p.fill?.toLowerCase() === "white" && p.d);
    const sub = all.find((p) => p.fill?.toLowerCase() === "black" && p.d);
    if (base?.d && sub?.d) {
      const fillPath = all.find((p) => p.mask && isHexFill(p.fill));
      return {
        operandDs: [base.d, sub.d],
        fill: fillPath?.fill ?? DEFAULT_SHAPE_FILL,
      };
    }
    const visible = all.filter((p) => isHexFill(p.fill));
    if (visible.length >= 1) {
      return { operandDs: [visible[0]!.d], fill: visible[0]!.fill ?? DEFAULT_SHAPE_FILL };
    }
    return null;
  }

  if (operation === "intersect") {
    const clips = all
      .filter((p) => p.d && !isHexFill(p.fill) && !p.mask)
      .map((p) => p.d);
    const uniqueClips = [...new Set(clips)];
    if (uniqueClips.length >= 2) {
      const fillPath = all.find((p) => isHexFill(p.fill) && !p.mask);
      return {
        operandDs: uniqueClips.slice(0, Math.max(2, uniqueClips.length)),
        fill: fillPath?.fill ?? DEFAULT_SHAPE_FILL,
      };
    }
    return null;
  }

  const operands = all.filter((p) => isHexFill(p.fill) && p.d);
  if (operands.length < 2 && operation !== "union") return null;
  if (operands.length < 1) return null;

  return {
    operandDs: operands.map((p) => p.d),
    fill: operands[0]!.fill ?? DEFAULT_SHAPE_FILL,
  };
}

/** Recover boolean operand path `d` strings from exported inline SVG. */
export function parseBooleanOperandsFromExportSvg(
  svg: HtmlImportElement,
  operation: BooleanOperation,
): { operandDs: string[]; fill: string } | null {
  return operandsFromPathRows(collectPathRows(svg), operation);
}

/** Fallback when the browser does not expose SVG nodes as element children. */
export function parseBooleanOperandsFromMarkup(
  markup: string,
  operation: BooleanOperation,
): { operandDs: string[]; fill: string } | null {
  if (!markup.trim()) return null;
  return operandsFromPathRows(parsePathTagsFromMarkup(markup), operation);
}

function pathPointsFromOperandD(d: string, groupWidth: number, groupHeight: number): PathPoint[] {
  let pts = svgPathDToPathPoints(d);
  if (pts.length >= 3) return pts;

  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  if (nums.length >= 4) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i]!;
      const y = nums[i + 1]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (Number.isFinite(minX)) {
      return [
        { id: newPathPointId(), x: minX, y: minY },
        { id: newPathPointId(), x: maxX, y: minY },
        { id: newPathPointId(), x: maxX, y: maxY },
        { id: newPathPointId(), x: minX, y: maxY },
      ];
    }
  }

  return [
    { id: newPathPointId(), x: 0, y: 0 },
    { id: newPathPointId(), x: groupWidth, y: 0 },
    { id: newPathPointId(), x: groupWidth, y: groupHeight },
    { id: newPathPointId(), x: 0, y: groupHeight },
  ];
}

export function pathNodesFromSvgOperands(
  operandDs: string[],
  parentId: string,
  groupWidth: number,
  groupHeight: number,
  fill: string,
  idGen: () => string,
): EditorNode[] {
  return operandDs.map((d, index) => {
    const pts = pathPointsFromOperandD(d, groupWidth, groupHeight);
    const bounds = pathBounds(pts);
    let node: EditorNode = {
      id: idGen(),
      parentId,
      type: "path",
      name: `Operand ${index + 1}`,
      x: bounds.x,
      y: bounds.y,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      pathPoints: pts.map((p) => ({
        ...p,
        x: p.x - bounds.x,
        y: p.y - bounds.y,
      })),
      pathClosed: true,
      flattenedPathData: d,
      fill,
      fillEnabled: true,
      fillOpacity: 1,
      strokePosition: "center",
    };
    node = normalizePathNode(node);
    return node;
  });
}
