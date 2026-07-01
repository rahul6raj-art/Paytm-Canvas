import { hashStringSha256 } from "@/lib/craftBridge/canvasExportHash";
import { patchBridgeCanvasPayloadIntoSource } from "@/lib/craftBridge/patchBridgeCanvasPayload";
import { patchLinkedReactSourceFromCanvas } from "@/lib/craftBridge/patchLinkedReactSource";
import { exportSafeBridgePageCss } from "@/lib/craftBridge/safeBridgeCssExport";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken, CanvasColorMode } from "@/lib/designTokens";
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
  childOrder: Record<string, string[]>;
  designTokens: Record<string, DesignToken>;
  assets: Record<string, EditorAsset>;
  link: CodeRoundTripLink;
  sourceHeader?: string | null;
  fileName?: string;
  canvasColorMode?: CanvasColorMode;
}): Promise<SemanticBridgeExportBundle> {
  const cssSources = input.cssFiles.map((f) => f.content).filter((c) => c?.trim());

  let tsx = patchLinkedReactSourceFromCanvas(input.sourceContent, input.nodes, {
    childOrder: input.childOrder,
    designTokens: input.designTokens,
    sourcePath: input.sourcePath,
    canvasColorMode: input.canvasColorMode,
    cssSources,
    additionsOnly: false,
    skipGenericTextPatches: true,
  });
  tsx = patchBridgeCanvasPayloadIntoSource({
    sourceContent: tsx,
    sourcePath: input.sourcePath,
    nodes: input.nodes,
    childOrder: input.childOrder,
    designTokens: input.designTokens,
    assets: input.assets,
    link: input.link,
    sourceHeader: input.sourceHeader,
    fileName: input.fileName,
  });
  const cssFiles = exportSafeBridgePageCss({
    sourcePath: input.sourcePath,
    cssPaths: input.cssPaths,
    cssFiles: input.cssFiles,
    nodes: input.nodes,
    designTokens: input.designTokens,
    canvasColorMode: input.canvasColorMode,
  });

  const hashParts = [
    tsx,
    ...cssFiles.map((f) => `${f.path}\0${f.content}`),
  ].join("\n");
  const hash = await hashStringSha256(hashParts);

  return { tsx, cssFiles, hash };
}
