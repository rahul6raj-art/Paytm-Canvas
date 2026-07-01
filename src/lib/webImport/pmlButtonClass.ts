/** Split DOM `className` into tokens (BEM / utility classes). */
export function splitDomClassTokens(className: string | undefined): string[] {
  return (className ?? "").trim().split(/\s+/).filter(Boolean);
}

/**
 * PML `<Button>` uses `btn`, `btn--stroke`, etc.
 * Must NOT match BEM classes like `header__icon-btn` (false positive on `\bbtn\b`).
 */
export function hasPmlButtonClassToken(className: string | undefined): boolean {
  return splitDomClassTokens(className).some((t) => t === "btn" || /^btn--/.test(t));
}

/** Outline / secondary CTAs (`btn--stroke`, etc.). */
export function hasPmlStrokeButtonClassToken(className: string | undefined): boolean {
  return splitDomClassTokens(className).some((t) =>
    /^btn--(?:stroke|outline|secondary|ghost)$/.test(t),
  );
}

/** Header icon taps — never frame-stroke (live UI is icon-only, no pill border). */
export function isPmlIconButtonClassName(className: string | undefined): boolean {
  const cls = className ?? "";
  return (
    /\bheader__icon-btn\b/.test(cls) ||
    /\bheader__back-btn\b/.test(cls) ||
    /\b__icon-btn\b/.test(cls)
  );
}
