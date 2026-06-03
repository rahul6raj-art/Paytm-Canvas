export { convertFigBytesToPaytmCraft, convertFigBytesToPaytmCraftAsync, type FigImportResult } from "./figToPaytmCraft";
export { convertFigFileAsync, type FigImportProgress } from "./convertFigFileAsync";

export function isFigmaFigFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".fig");
}
