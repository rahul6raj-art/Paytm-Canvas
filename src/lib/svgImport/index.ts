import { convertSvgToSceneGraph, type SvgImportResult } from "@/lib/svgImport/convertSvgNodeToSceneNode";
import { parseSvg } from "@/lib/svgImport/parseSvg";
import {
  createSvgImportDiagnostics,
  type SvgImportDiagnostics,
} from "@/lib/svgImport/svgImportDiagnostics";

export type { SvgImportResult, SvgImportDiagnostics };
export { parseSvg, convertSvgToSceneGraph, createSvgImportDiagnostics };

/** Full pipeline: parse XML → convert to scene graph. */
export function importSvgSourceToEditorGraph(
  source: string,
  fileName = "Imported SVG",
): SvgImportResult | null {
  const svg = parseSvg(source);
  if (!svg) return null;
  const diag = createSvgImportDiagnostics();
  return convertSvgToSceneGraph(svg, fileName, diag);
}

export function convertSvgTree(source: string, fileName = "Imported SVG"): SvgImportResult | null {
  return importSvgSourceToEditorGraph(source, fileName);
}

export async function readSvg(file: File): Promise<string> {
  return file.text();
}

import { inlineExternalSvgImages } from "@/lib/svgImport/inlineExternalImages";

export async function importSvgFileToEditorGraph(file: File): Promise<SvgImportResult | null> {
  const source = await readSvg(file);
  const result = importSvgSourceToEditorGraph(source, file.name || "Imported SVG");
  if (!result) return null;
  const nodes = { ...result.nodes };
  const assets = await inlineExternalSvgImages(nodes, result.assets);
  return { ...result, nodes, assets };
}

export function isSvgLayerImportFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/svg+xml") return true;
  return file.name.toLowerCase().endsWith(".svg");
}
