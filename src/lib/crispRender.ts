/** Align a world coordinate to the device pixel grid for crisp DOM/SVG rendering. */
export function snapWorldToDevicePixel(
  world: number,
  zoom: number,
  pan: number,
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  const screen = world * zoom + pan;
  const snapped = Math.round(screen * dpr) / dpr;
  return (snapped - pan) / zoom;
}

/** Snap a screen-space coordinate (e.g. pan) to the device pixel grid. */
export function snapScreenToDevicePixel(
  screenPx: number,
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  return Math.round(screenPx * dpr) / dpr;
}

export function snapPanToDevicePixels(
  pan: { x: number; y: number },
  dpr?: number,
): { x: number; y: number } {
  return {
    x: snapScreenToDevicePixel(pan.x, dpr),
    y: snapScreenToDevicePixel(pan.y, dpr),
  };
}

/** Snap width/height so edges land on device pixels at the current zoom. */
export function snapWorldSizeToDevicePixel(
  worldSize: number,
  zoom: number,
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  return Math.max(0, Math.round(worldSize * zoom * dpr) / (zoom * dpr));
}

export function snapWorldRectToDevicePixels(
  rect: { x: number; y: number; width: number; height: number },
  zoom: number,
  pan: { x: number; y: number },
  dpr?: number,
): { x: number; y: number; width: number; height: number } {
  const x = snapWorldToDevicePixel(rect.x, zoom, pan.x, dpr);
  const y = snapWorldToDevicePixel(rect.y, zoom, pan.y, dpr);
  const width = snapWorldSizeToDevicePixel(rect.width, zoom, dpr);
  const height = snapWorldSizeToDevicePixel(rect.height, zoom, dpr);
  return { x, y, width, height };
}
