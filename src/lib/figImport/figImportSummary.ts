export type FigmaImportSummary = {
  layerCount: number;
  rootCount: number;
  fileName: string;
  warning?: string;
};

export function formatImportToast(summary: FigmaImportSummary): string {
  const base = `Imported “${summary.fileName}” — ${summary.rootCount} frame(s), ${summary.layerCount} layer(s).`;
  return summary.warning ? `${base} ${summary.warning}` : base;
}
