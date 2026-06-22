"use client";

import { CornerRadiusHandles } from "./CornerRadiusHandles";
import { ParametricShapeCornerRadiusHandles } from "./ParametricShapeCornerRadiusHandles";
import { EllipseArcHandles } from "./EllipseArcHandles";
import { LineHandles } from "./LineHandles";
import { PolygonHandles } from "./PolygonHandles";
import { StarHandles } from "./StarHandles";
import { ArrowHeadHandles } from "./ArrowHeadHandles";

/** Shape-specific edit handles rendered above the selection box (z-33). */
export function ShapeEditHandlesOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[33]" data-shape-edit-overlay>
      <CornerRadiusHandles />
      <ParametricShapeCornerRadiusHandles />
      <EllipseArcHandles />
      <StarHandles />
      <LineHandles />
      <PolygonHandles />
      <ArrowHeadHandles />
    </div>
  );
}
