import type { EditorNode } from "@/stores/useEditorStore";
import type {
  FigImportFidelityCapture,
  FigmaFidelityProjectReport,
} from "@/lib/figImport/figFidelityTypes";
import { buildFigFidelityReport } from "@/lib/figImport/figFidelityReport";

export function runFigFidelityInspection(
  captures: Record<string, FigImportFidelityCapture>,
  nodes: Record<string, EditorNode>,
): FigmaFidelityProjectReport {
  return buildFigFidelityReport(captures, nodes);
}
