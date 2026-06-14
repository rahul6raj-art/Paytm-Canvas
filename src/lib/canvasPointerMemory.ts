/** Last pointer position on the canvas (world space) for paste placement. */
let lastWorld: { x: number; y: number } | null = null;

export function setLastCanvasWorldPoint(point: { x: number; y: number } | null): void {
  lastWorld = point;
}

export function getLastCanvasWorldPoint(): { x: number; y: number } | null {
  return lastWorld;
}
