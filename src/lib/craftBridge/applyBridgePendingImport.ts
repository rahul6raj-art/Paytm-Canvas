import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";
import { normalizeBridgeImportSlice } from "@/lib/craftBridge/normalizeBridgeImportSlice";
import {
  removeRootSubtree,
  resolveBridgeImportStrategy,
  tagSliceRootsWithBridgeSource,
} from "@/lib/craftBridge/bridgeImportStrategy";
import {
  enrichSliceWithProjectColorTokens,
  themeFromPreviewUrl,
} from "@/lib/craftBridge/projectTokenCss";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  fitCanvasToImportedDocumentWithRetry,
  zoomCanvasToFit,
} from "@/lib/viewportZoom";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { useEditorStore } from "@/stores/useEditorStore";

export type ApplyBridgePendingImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      layerCount: number;
      rootCount: number;
      mode: "replace" | "append" | "replace-root";
    }
  | { ok: false; error: string };

export async function applyBridgePendingImport(
  pending: CraftBridgePendingImport,
): Promise<ApplyBridgePendingImportResult> {
  const rawSlice = pending.slice;
  const activePage =
    rawSlice?.pages && rawSlice.activePageId
      ? rawSlice.pages[rawSlice.activePageId]
      : undefined;
  const hasLayers =
    Object.keys(rawSlice?.nodes ?? {}).length > 0 ||
    Object.keys(activePage?.nodes ?? {}).length > 0;
  if (!rawSlice || !hasLayers) {
    return {
      ok: false,
      error:
        "Import had no visible layers. Push a page folder with a .tsx or .html entry file and companion .css.",
    };
  }

  const store = useEditorStore.getState();
  const strategy = resolveBridgeImportStrategy(store, pending.link?.sourcePath);
  let applyMode: "replace" | "append" = strategy.mode === "append" ? "append" : "replace";
  let replaceRootPosition: { x: number; y: number } | null = null;

  if (strategy.mode === "replace-root") {
    replaceRootPosition = { x: strategy.x, y: strategy.y };
    const cleaned = removeRootSubtree(store.nodes, store.childOrder, strategy.rootId);
    useEditorStore.setState({
      nodes: cleaned.nodes,
      childOrder: cleaned.childOrder,
      selectedIds: [],
    });
    applyMode = "append";
  }

  let slice = normalizeBridgeImportSlice(rawSlice);
  slice = {
    ...slice,
    nodes: tagSliceRootsWithBridgeSource(
      slice.nodes,
      slice.childOrder,
      pending.link?.sourcePath,
    ),
  };
  slice = await enrichSliceWithProjectColorTokens(slice, {
    link: pending.link ?? null,
    theme: themeFromPreviewUrl(pending.link?.previewUrl),
  });

  const rootCount = slice.childOrder[EDITOR_ROOT_KEY]?.length ?? 0;
  const layerCount = Object.keys(slice.nodes).length;
  if (layerCount === 0 || rootCount === 0) {
    return {
      ok: false,
      error:
        "Import had no visible layers. Push a page folder with a .tsx or .html entry file and companion .css.",
    };
  }

  try {
    await useEditorStore.getState().applyGeneratedDesign(slice, applyMode, {
      recordHistory: true,
      zoomToFit: false,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not apply imported design to canvas.",
    };
  }

  if (replaceRootPosition) {
    const after = useEditorStore.getState();
    const roots = after.childOrder[EDITOR_ROOT_KEY] ?? [];
    const newRootId = roots[roots.length - 1];
    const node = newRootId ? after.nodes[newRootId] : undefined;
    if (newRootId && node && !node.parentId) {
      useEditorStore.setState({
        nodes: {
          ...after.nodes,
          [newRootId]: {
            ...node,
            x: replaceRootPosition.x,
            y: replaceRootPosition.y,
          },
        },
        selectedIds: [newRootId],
      });
    }
  }

  const resultMode =
    strategy.mode === "replace-root" ? "replace-root" : applyMode;

  if (applyMode === "append") {
    await fitCanvasToImportedDocumentWithRetry(8);
    zoomCanvasToFit();
  } else {
    await fitCanvasToImportedDocumentWithRetry(20);
  }

  return { ok: true, slice, layerCount, rootCount, mode: resultMode };
}
