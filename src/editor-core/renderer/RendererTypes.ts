import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";
import type { RendererMode } from "@/lib/rendererMode";

export type { RendererMode };

/** Node snapshot passed to scene renderers (alias of editor node). */
export type RenderableNode = EditorNode;

export type RenderableAssetMap = Record<string, EditorAsset>;

export type SceneRendererProps = {
  rootIds: string[];
  nodes: Record<string, RenderableNode>;
  childOrder: Record<string, string[]>;
  assets: RenderableAssetMap;
  designTokens: Record<string, DesignToken>;
  /** For SVG artboard labels (screen-sized at current zoom). */
  selectedIds?: string[];
  zoom?: number;
  /** Hide from vector/tile scene while inline text edit overlay is active. */
  editingTextId?: string | null;
};
