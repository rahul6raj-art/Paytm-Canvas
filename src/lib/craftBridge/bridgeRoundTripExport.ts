import { hashStringSha256 } from "@/lib/craftBridge/canvasExportHash";
import { patchLinkedReactSourceFromCanvas } from "@/lib/craftBridge/patchLinkedReactSource";
import { exportSafeBridgePageCss } from "@/lib/craftBridge/safeBridgeCssExport";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export type SemanticBridgeExportBundle = {
  tsx: string;
  cssFiles: { path: string; content: string }[];
  hash: string;
};

export async function buildSemanticBridgeExportBundle(input: {
  sourcePath: string;
  cssPaths: string[];
  sourceContent: string;
  cssFiles: { path: string; content: string }[];
  nodes: Record<string, EditorNode>;
  designTokens: Record<string, DesignToken>;
}): Promise<SemanticBridgeExportBundle> {
  const tsx = patchLinkedReactSourceFromCanvas(input.sourceContent, input.nodes);
  const cssFiles = exportSafeBridgePageCss({
    sourcePath: input.sourcePath,
    cssPaths: input.cssPaths,
    cssFiles: input.cssFiles,
    nodes: input.nodes,
    designTokens: input.designTokens,
  });

  const hashParts = [
    tsx,
    ...cssFiles.map((f) => `${f.path}\0${f.content}`),
  ].join("\n");
  const hash = await hashStringSha256(hashParts);

  return { tsx, cssFiles, hash };
}
