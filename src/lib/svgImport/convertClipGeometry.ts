import { convertSvgPathToVector, translatePathSegments } from "@/lib/svgImport/convertSvgPathToVector";
import { absoluteSegmentsToPathD, parseSvgPathToAbsolute } from "@/lib/svgImport/parseSvgPath";
import { parseTransformList } from "@/lib/svgImport/parseTransform";
import type { SvgElement } from "@/lib/svgImport/parseSvg";
import { parseLength } from "@/lib/svgImport/svgMatrix";
import { identityMatrix, multiplyMatrix, type Matrix2D } from "@/lib/transformMath";
import type { EditorNode } from "@/stores/useEditorStore";

const SHAPE_TAGS = new Set(["rect", "circle", "ellipse", "line", "polyline", "polygon", "path"]);

function polylineAttrToPathD(raw: string, closed: boolean): string | null {
  const nums = raw
    .trim()
    .split(/[\s,]+/)
    .map((v) => parseFloat(v))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 4) return null;
  let d = `M ${nums[0]} ${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) {
    d += ` L ${nums[i]} ${nums[i + 1]}`;
  }
  if (closed) d += " Z";
  return d;
}

function shapeElementToPathD(el: SvgElement, boxW: number, boxH: number): string | null {
  const tag = el.tagLower;
  if (tag === "rect") {
    const x = parseLength(el.getAttr("x")) * boxW;
    const y = parseLength(el.getAttr("y")) * boxH;
    const w = parseLength(el.getAttr("width")) * boxW;
    const h = parseLength(el.getAttr("height")) * boxH;
    if (w <= 0 || h <= 0) return null;
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  if (tag === "circle") {
    const r = parseLength(el.getAttr("r")) * Math.min(boxW, boxH);
    if (r <= 0) return null;
    const cx = parseLength(el.getAttr("cx")) * boxW;
    const cy = parseLength(el.getAttr("cy")) * boxH;
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  if (tag === "ellipse") {
    const rx = parseLength(el.getAttr("rx")) * boxW;
    const ry = parseLength(el.getAttr("ry")) * boxH;
    if (rx <= 0 || ry <= 0) return null;
    const cx = parseLength(el.getAttr("cx")) * boxW;
    const cy = parseLength(el.getAttr("cy")) * boxH;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }
  if (tag === "path") {
    const d = el.getAttr("d");
    if (!d) return null;
    const segs = parseSvgPathToAbsolute(d);
    return segs.length > 0 ? absoluteSegmentsToPathD(segs) : null;
  }
  if (tag === "polyline" || tag === "polygon") {
    const raw = el.getAttr("points");
    if (!raw) return null;
    return polylineAttrToPathD(raw, tag === "polygon");
  }
  return null;
}

function scalePathToBox(pathD: string, boxW: number, boxH: number): string {
  const segs = parseSvgPathToAbsolute(pathD);
  if (segs.length === 0) return pathD;
  const scaled = segs.map((seg) => {
    if (seg.type === "M" || seg.type === "L") {
      return { ...seg, x: seg.x * boxW, y: seg.y * boxH };
    }
    if (seg.type === "C") {
      return {
        ...seg,
        x1: seg.x1 * boxW,
        y1: seg.y1 * boxH,
        x2: seg.x2 * boxW,
        y2: seg.y2 * boxH,
        x: seg.x * boxW,
        y: seg.y * boxH,
      };
    }
    return seg;
  });
  return absoluteSegmentsToPathD(scaled);
}

/** Build a combined path `d` for clipPath / mask definition children in host-local space. */
export function clipDefToCombinedPathD(
  defEl: SvgElement,
  host: Pick<EditorNode, "width" | "height">,
  units: "userSpaceOnUse" | "objectBoundingBox",
  rootMatrix: Matrix2D,
  warnings?: string[],
): string | null {
  const defM = parseTransformList(defEl.getAttr("transform"), warnings);
  const boxW = units === "objectBoundingBox" ? Math.max(1, host.width) : 1;
  const boxH = units === "objectBoundingBox" ? Math.max(1, host.height) : 1;
  const parts: string[] = [];

  for (const child of defEl.childElements()) {
    if (!SHAPE_TAGS.has(child.tagLower)) continue;
    const childM = parseTransformList(child.getAttr("transform"), warnings);
    let pathD = shapeElementToPathD(child, boxW, boxH);
    if (!pathD) continue;

    if (units === "objectBoundingBox") {
      parts.push(pathD);
      continue;
    }

    const worldM = multiplyMatrix(multiplyMatrix(rootMatrix, defM), childM);
    const localized = convertSvgPathToVector(pathD, worldM, rootMatrix, "nonzero", warnings);
    if (localized?.flattenedPathData) {
      const segs = parseSvgPathToAbsolute(localized.flattenedPathData);
      parts.push(
        absoluteSegmentsToPathD(
          translatePathSegments(segs, localized.x, localized.y),
        ),
      );
    } else if (localized?.pathPoints && localized.pathPoints.length >= 2) {
      parts.push(pathD);
    }
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}

export function clipPathUnits(defEl: SvgElement): "userSpaceOnUse" | "objectBoundingBox" {
  return defEl.getAttr("clipPathUnits") === "userSpaceOnUse" ? "userSpaceOnUse" : "objectBoundingBox";
}

export function maskUnits(defEl: SvgElement): "userSpaceOnUse" | "objectBoundingBox" {
  return defEl.getAttr("maskUnits") === "objectBoundingBox" ||
    defEl.getAttr("maskContentUnits") === "objectBoundingBox"
    ? "objectBoundingBox"
    : "userSpaceOnUse";
}

export function identityRootMatrix(): Matrix2D {
  return identityMatrix();
}

/** Scale a 0–1 objectBoundingBox path into host pixel space. */
export function objectBoxPathToHostLocal(pathD: string, hostW: number, hostH: number): string {
  return scalePathToBox(pathD, hostW, hostH);
}
