/** Soft cap — imports above this warn the user (canvas may be slow). */
export const SVG_IMPORT_NODE_WARN = 2_000;
/** Hard cap — refuse import above this to avoid freezing the editor. */
export const SVG_IMPORT_NODE_HARD_CAP = 12_000;

export function svgImportNodeLimitMessage(count: number): string | null {
  if (count > SVG_IMPORT_NODE_HARD_CAP) {
    return `This SVG has ${count.toLocaleString()} layers — too many to import safely (limit ${SVG_IMPORT_NODE_HARD_CAP.toLocaleString()}). Try simplifying the file in Illustrator/Figma first.`;
  }
  if (count > SVG_IMPORT_NODE_WARN) {
    return `This SVG has ${count.toLocaleString()} layers. The editor may be slow until you simplify or delete unused groups.`;
  }
  return null;
}
