import type { DomSnapshotNode, ImportWebPageMeta, ImportWebSceneNode } from "@/lib/webImport/types";
import { buildDesignTree } from "@/lib/webImport/designNodeBuilder";
import { designTreeToScene } from "@/lib/webImport/canvasNodeBuilder";
import { compareFidelity, scoreDesignTree, scoreSceneTree } from "@/lib/webImport/fidelityValidator";
import { sanitizeDomSnapshotText } from "@/lib/webImport/inferLayoutFromBounds";

export interface DesignNativeImportResult {
  scene: ImportWebSceneNode;
  assets: Record<string, { id: string; dataUrl: string; name: string; mimeType: string }>;
  fidelity: ReturnType<typeof compareFidelity>;
}

/**
 * Design-native web import pipeline:
 * DOM snapshot → DesignNode tree → Canvas scene graph
 */
export function runDesignNativeImport(
  domRoot: DomSnapshotNode,
  page: ImportWebPageMeta,
): DesignNativeImportResult {
  const sanitized = sanitizeDomSnapshotText(domRoot);
  const designRoot = buildDesignTree(sanitized);
  // Repeated-component detection strips instance subtrees and renames masters — skip for web pages.
  // detectRepeatedComponents(designRoot);
  const { scene, assets } = designTreeToScene(designRoot, page);
  const fidelity = compareFidelity(scoreDesignTree(designRoot), scoreSceneTree(scene));
  return { scene, assets, fidelity };
}

/** @deprecated Use runDesignNativeImport — kept for backward compatibility. */
export function domSnapshotToScene(
  root: DomSnapshotNode,
  page: ImportWebPageMeta,
): { scene: ImportWebSceneNode; assets: Record<string, { id: string; dataUrl: string; name: string; mimeType: string }> } {
  const result = runDesignNativeImport(root, page);
  return { scene: result.scene, assets: result.assets };
}
