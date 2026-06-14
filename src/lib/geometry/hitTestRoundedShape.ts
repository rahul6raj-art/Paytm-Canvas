/** Hit-test a Path2D in local coordinates (caller applies inverse transform). */
export function hitTestShapePath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  path: Path2D,
  localX: number,
  localY: number,
  opts: {
    filled?: boolean;
    strokeWidth?: number;
  } = {},
): boolean {
  const filled = opts.filled ?? true;
  const strokeWidth = opts.strokeWidth ?? 0;

  if (filled && ctx.isPointInPath(path, localX, localY)) return true;

  if (strokeWidth > 0) {
    ctx.save();
    ctx.lineWidth = strokeWidth;
    if (ctx.isPointInStroke(path, localX, localY)) {
      ctx.restore();
      return true;
    }
    ctx.restore();
  }

  return false;
}
