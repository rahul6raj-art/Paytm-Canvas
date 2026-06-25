import { strokeAttrsForSvgMarkup } from "@/lib/stroke";
import {
  resolveStrokeSpec,
  strokeSpecCanvasDash,
  strokeSpecColorRgba,
  strokeSpecIsVisible,
  type StrokeSpec,
} from "@/lib/strokeSpec";
import type { EditorNode } from "@/stores/useEditorStore";

export type TextLayerStroke = {
  spec: StrokeSpec;
  color: string;
  canvasDash: number[];
  svgExtraAttrs: string;
};

export function resolveTextLayerStroke(node: EditorNode): TextLayerStroke | null {
  const spec = resolveStrokeSpec(node);
  if (!strokeSpecIsVisible(spec)) return null;
  return {
    spec,
    color: strokeSpecColorRgba(spec),
    canvasDash: strokeSpecCanvasDash(spec),
    svgExtraAttrs: strokeAttrsForSvgMarkup(node),
  };
}

type CanvasTextContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Apply layer stroke style for canvas `strokeText` (caller restores line dash). */
export function applyCanvasTextLayerStroke(
  ctx: CanvasTextContext,
  stroke: TextLayerStroke,
): void {
  ctx.lineWidth = stroke.spec.width;
  ctx.strokeStyle = stroke.color;
  ctx.lineJoin = stroke.spec.join;
  ctx.lineCap = stroke.spec.cap;
  if (stroke.canvasDash.length > 0) {
    ctx.setLineDash(stroke.canvasDash);
  }
}
