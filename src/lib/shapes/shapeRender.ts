import type { EditorNode } from "@/stores/useEditorStore";
import { pathToSvgD } from "@/lib/pathGeometry";
import { editorNodeToShape, type ShapeModel, type StrokeStyle } from "./shapeModel";

function strokeDash(style: StrokeStyle, width: number): number[] {
  if (style === "dashed") return [width * 4, width * 2];
  if (style === "dotted") return [width, width * 1.5];
  return [];
}

/** Render a shape onto Canvas2D in local box coordinates. */
export function renderShape(ctx: CanvasRenderingContext2D, shapeNode: EditorNode | ShapeModel): void {
  const shape = "shapeType" in shapeNode ? shapeNode : editorNodeToShape(shapeNode);
  if (!shape) return;

  ctx.save();
  ctx.globalAlpha = shape.opacity;
  const dash = strokeDash(shape.strokeStyle, shape.strokeWidth);
  if (dash.length) ctx.setLineDash(dash);

  switch (shape.shapeType) {
    case "rectangle":
      renderRect(ctx, shape);
      break;
    case "ellipse":
      renderEllipse(ctx, shape);
      break;
    case "line":
      renderLine(ctx, shape);
      break;
    default:
      renderPath(ctx, shape);
      break;
  }
  ctx.restore();
}

function renderRect(ctx: CanvasRenderingContext2D, shape: ShapeModel): void {
  const r = Math.min(shape.cornerRadius ?? 0, shape.width / 2, shape.height / 2);
  ctx.beginPath();
  if (r > 0) roundRect(ctx, 0, 0, shape.width, shape.height, r);
  else ctx.rect(0, 0, shape.width, shape.height);
  if (shape.fill !== "transparent") {
    ctx.fillStyle = shape.fill;
    ctx.fill();
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
}

function renderEllipse(ctx: CanvasRenderingContext2D, shape: ShapeModel): void {
  ctx.beginPath();
  ctx.ellipse(shape.width / 2, shape.height / 2, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
  if (shape.fill !== "transparent") {
    ctx.fillStyle = shape.fill;
    ctx.fill();
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;
    ctx.stroke();
  }
}

function renderLine(ctx: CanvasRenderingContext2D, shape: ShapeModel): void {
  ctx.beginPath();
  ctx.moveTo(0, shape.height / 2);
  ctx.lineTo(shape.width, shape.height / 2);
  ctx.strokeStyle = shape.stroke;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = "round";
  ctx.stroke();
}

function renderPath(ctx: CanvasRenderingContext2D, shape: ShapeModel): void {
  const pts = shape.pathPoints ?? [];
  const d = pathToSvgD(pts, shape.pathClosed ?? false);
  if (!d) return;
  const path = new Path2D(d);
  if (shape.fill !== "transparent" && shape.pathClosed) {
    ctx.fillStyle = shape.fill;
    ctx.fill(path);
  }
  if (shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineJoin = "round";
    ctx.stroke(path);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
