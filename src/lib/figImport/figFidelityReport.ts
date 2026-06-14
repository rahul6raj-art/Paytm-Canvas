import type { EditorNode } from "@/stores/useEditorStore";
import type {
  FigImportFidelityCapture,
  FigmaFidelityProjectReport,
  FidelityEngine,
} from "@/lib/figImport/figFidelityTypes";
import { nodeFidelityReport } from "@/lib/figImport/figFidelityDiff";
import { snapshotFromEditorNode } from "@/lib/figImport/figSourceSnapshot";

export function buildFigFidelityReport(
  captures: Record<string, FigImportFidelityCapture>,
  nodes: Record<string, EditorNode>,
): FigmaFidelityProjectReport {
  const nodeReports = [];
  const unsupportedSet = new Set<string>();
  const engineBreakdown: Record<FidelityEngine, number> = {
    layout: 0,
    stroke: 0,
    text: 0,
    effects: 0,
    masks: 0,
    gradients: 0,
    constraints: 0,
    components: 0,
    variables: 0,
    import: 0,
  };

  let matchedNodes = 0;
  let mismatchedNodes = 0;
  let scoreSum = 0;

  for (const [nodeId, capture] of Object.entries(captures)) {
    const editorNode = nodes[nodeId];
    if (!editorNode) continue;

    const canvas = snapshotFromEditorNode(editorNode);
    const report = nodeFidelityReport(nodeId, capture.figma, canvas);
    nodeReports.push(report);
    scoreSum += report.fidelityScore;

    if (report.mismatches.length === 0) matchedNodes++;
    else mismatchedNodes++;

    for (const feat of capture.figma.unsupported ?? []) {
      unsupportedSet.add(feat);
    }
    for (const m of report.mismatches) {
      engineBreakdown[m.engine] = (engineBreakdown[m.engine] ?? 0) + 1;
    }
  }

  nodeReports.sort((a, b) => {
    const impactA = a.mismatches.reduce((s, m) => s + m.impact, 0);
    const impactB = b.mismatches.reduce((s, m) => s + m.impact, 0);
    return impactB - impactA;
  });

  const totalNodes = nodeReports.length;
  const fidelityScore = totalNodes
    ? Math.round(scoreSum / totalNodes)
    : 100;

  return {
    totalNodes,
    matchedNodes,
    mismatchedNodes,
    unsupportedFeatures: [...unsupportedSet].sort(),
    fidelityScore,
    nodes: nodeReports,
    engineBreakdown,
  };
}
