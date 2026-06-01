export { convertFigBytesToPaytmCraft, type FigImportResult } from "./figToPaytmCraft";

export function isFigmaFigFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".fig");
}
