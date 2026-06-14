/** Extract `#id` from `url(#id)` references (clip-path, mask, filter, fill, etc.). */
export function resolveSvgUrlRef(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.match(/url\(#([^)]+)\)/);
  return m?.[1];
}

export function readSvgEffectRef(
  el: { getAttr(name: string): string | undefined },
  attr: string,
  styleKey?: string,
): string | undefined {
  const style = el.getAttr("style");
  const fromStyle = styleKey && style
    ? style
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.toLowerCase().startsWith(`${styleKey}:`))
        ?.split(":")[1]
        ?.trim()
    : undefined;
  return resolveSvgUrlRef(el.getAttr(attr) ?? fromStyle);
}
