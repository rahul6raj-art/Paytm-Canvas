import type { EditorNode } from "@/stores/useEditorStore";
import {
  arcInnerRadiusRatioFromPointer,
  effectiveEllipseArc,
  ellipseEndAngleUnwrapped,
  isFullEllipseArc,
  parametricDegreesFromLocalPoint,
  startDegAndSweepFromStartHandleDrag,
  sweepDegFromEndHandleDrag,
} from "@/lib/shapes/ellipseArc";
import type { EditHandleKind } from "@/lib/editMode/types";

export function ellipseArcPatchFromDrag(
  node: Pick<EditorNode, "width" | "height" | "arcStartDeg" | "arcSweepDeg" | "arcInnerRadiusRatio">,
  kind: EditHandleKind,
  localX: number,
  localY: number,
  opts?: { shiftKey?: boolean },
): Partial<EditorNode> | null {
  if (node.width <= 0 || node.height <= 0) return null;
  const arc = effectiveEllipseArc(node);
  const cx = node.width / 2;
  const cy = node.height / 2;
  const rx = node.width / 2;
  const ry = node.height / 2;

  if (kind === "ellipseArcRatio") {
    const ratio = arcInnerRadiusRatioFromPointer(node.width, node.height, localX, localY, opts);
    return { arcInnerRadiusRatio: ratio };
  }

  if (kind === "ellipseArcStart") {
    const moveAngle = parametricDegreesFromLocalPoint(cx, cy, rx, ry, localX, localY);
    const fixedEnd = ellipseEndAngleUnwrapped(arc.startDeg, arc.sweepDeg, moveAngle);
    const next = startDegAndSweepFromStartHandleDrag(fixedEnd, moveAngle, opts);
    return { arcStartDeg: next.startDeg, arcSweepDeg: next.sweepDeg };
  }

  if (kind === "ellipseArcEnd" || kind === "ellipseArcSweep") {
    const moveAngle = parametricDegreesFromLocalPoint(cx, cy, rx, ry, localX, localY);
    const fixedEnd = ellipseEndAngleUnwrapped(arc.startDeg, arc.sweepDeg, moveAngle);
    const sweepDeg = sweepDegFromEndHandleDrag(arc.startDeg, fixedEnd, moveAngle, {
      shiftKey: opts?.shiftKey,
      fromFullCircle: isFullEllipseArc(arc.sweepDeg),
    });
    return { arcSweepDeg: sweepDeg };
  }

  return null;
}
