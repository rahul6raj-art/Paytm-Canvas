import { ROOT } from "@/stores/useEditorStore";
import type { EditorNode } from "@/stores/useEditorStore";
import type { EditorAsset } from "@/lib/documentPersistence";
import { EMPTY_CHILD_IDS } from "@/lib/editorConstants";
import type { CraftEngineAssetSummary, CraftEngineDocument } from "@/engine/craftEngineTypes";

function averageColorFromDataUrl(dataUrl: string | undefined): string | undefined {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return undefined;
  return "#9aa0a6";
}

function buildAssetSummaries(
  nodes: Record<string, EditorNode>,
  assets: Record<string, EditorAsset> | undefined,
): Record<string, CraftEngineAssetSummary> {
  const out: Record<string, CraftEngineAssetSummary> = {};
  if (!assets) return out;

  const referenced = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.type === "image" && node.assetId) referenced.add(node.assetId);
  }

  for (const assetId of referenced) {
    const asset = assets[assetId];
    if (!asset) continue;
    out[assetId] = {
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      averageColor: averageColorFromDataUrl(asset.dataUrl),
      mimeType: asset.mimeType,
    };
  }
  return out;
}

/** Minimal document slice for the GPU engine (no UI / transient state). */
export function toCraftEngineDocument(input: {
  rootIds: readonly string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets?: Record<string, EditorAsset>;
}): CraftEngineDocument {
  return {
    rootIds: [...input.rootIds],
    nodes: input.nodes,
    childOrder: input.childOrder,
    assets: buildAssetSummaries(input.nodes, input.assets),
  };
}

export function craftEngineDocumentFromStore(input: {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  rootIds?: readonly string[];
  assets?: Record<string, EditorAsset>;
}): CraftEngineDocument {
  const rootIds = input.rootIds ?? input.childOrder[ROOT] ?? EMPTY_CHILD_IDS;
  return toCraftEngineDocument({
    rootIds,
    nodes: input.nodes,
    childOrder: input.childOrder,
    assets: input.assets,
  });
}
