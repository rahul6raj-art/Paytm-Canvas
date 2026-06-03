export { convertFigBytesToPaytmCraft, type FigImportResult } from "./figToPaytmCraft";
export { convertFigFileAsync } from "./convertFigFileAsync";

export function isFigmaFigFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".fig");
}
