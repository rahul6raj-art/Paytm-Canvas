import type { ResolvedVectorNodePaths } from "openfig-core";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import type { FigColor } from "@/lib/figImport/figPaintCore";

export type ImportCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  idMap: Map<string, string>;
  variableColors: Map<string, FigColor>;
  vectorPathsCache: Map<string, ResolvedVectorNodePaths>;
  /** Figma guid key → component master editor node id */
  componentMasters: Map<string, string>;
  /** Figma variable guid → design token id */
  tokensByVariableKey: Map<string, string>;
  seq: number;
};
