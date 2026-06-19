/** Count top-level line tspans in svgTextMarkup output (ignores gradient mask duplicates). */
export function countTspans(svg: string): number {
  const textBlock = svg.match(/<text[^>]*>([\s\S]*?)<\/text>/);
  if (!textBlock) {
    const maskText = svg.match(/<text[^>]*fill="white"[^>]*>([\s\S]*?)<\/text>/);
    return (maskText?.[1]?.match(/<tspan/g) ?? []).length;
  }
  return (textBlock[1]?.match(/<tspan/g) ?? []).length;
}
