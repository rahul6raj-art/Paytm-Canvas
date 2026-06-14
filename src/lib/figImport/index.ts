export { convertFigBytesToPaytmCraft, convertFigBytesToPaytmCraftAsync, type FigImportResult } from "./figToPaytmCraft";
export { convertFigFileAsync, type FigImportProgress } from "./convertFigFileAsync";
export { finalizeFigmaImportToEditor } from "./finalizeFigmaImport";
export { formatImportToast, type FigmaImportSummary } from "./figImportSummary";
export { runFigFidelityInspection } from "./runFigFidelityInspection";
export type {
  FigmaFidelityProjectReport,
  NodeFidelityReport,
  FidelityMismatch,
  FigImportFidelityCapture,
} from "./figFidelityTypes";

export function isFigmaFigFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".fig");
}

/** First Figma `.fig` file in a drag-and-drop payload, if any. */
export function figFileFromDataTransfer(dt: DataTransfer): File | null {
  for (const file of dt.files) {
    if (isFigmaFigFile(file)) return file;
  }
  for (const item of dt.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isFigmaFigFile(file)) return file;
  }
  return null;
}

export function canAcceptFigFileDrop(dt: DataTransfer): boolean {
  if (figFileFromDataTransfer(dt)) return true;
  if (![...dt.types].includes("Files")) return false;
  // During drag-over many browsers hide `files` until drop — still allow the drop gesture.
  return dt.files.length === 0;
}
