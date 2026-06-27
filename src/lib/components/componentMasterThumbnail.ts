import type { EditorAsset } from "@/lib/documentPersistence";
import { collectSubtreeIds } from "@/lib/editorGraph";
import type { CanvasColorMode, DesignToken } from "@/lib/designTokens";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import type { EditorNode } from "@/stores/useEditorStore";

export type ComponentMasterThumbnail = {
  svg: string;
  width: number;
  height: number;
};

/** Render a component master subtree in local coordinates for panel thumbnails. */
export function buildComponentMasterThumbnail(
  masterId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  options: {
    assets?: Record<string, EditorAsset>;
    designTokens?: Record<string, DesignToken>;
    colorMode?: CanvasColorMode;
    cssSources?: string[];
  } = {},
): ComponentMasterThumbnail | null {
  const master = nodes[masterId];
  if (!master || master.visible === false) return null;

  const subtreeIds = new Set(collectSubtreeIds(masterId, childOrder));
  const localNodes: Record<string, EditorNode> = {};
  for (const id of subtreeIds) {
    const node = nodes[id];
    if (!node) continue;
    localNodes[id] = id === masterId ? { ...node, parentId: null, x: 0, y: 0 } : { ...node };
  }

  const localChildOrder: Record<string, string[]> = {};
  for (const id of subtreeIds) {
    const kids = (childOrder[id] ?? []).filter((cid) => subtreeIds.has(cid));
    if (kids.length > 0) localChildOrder[id] = kids;
  }

  const width = Math.max(1, Math.round(master.width));
  const height = Math.max(1, Math.round(master.height));
  const scene = buildSvgScene({
    rootIds: [masterId],
    nodes: localNodes,
    childOrder: localChildOrder,
    assets: options.assets,
    designTokens: options.designTokens,
    colorMode: options.colorMode ?? "light",
    cssSources: options.cssSources,
  });

  if (!scene.body.trim() || scene.renderedNodeCount === 0) return null;

  const defs = scene.defs ? `<defs>${scene.defs}</defs>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${defs}${scene.body}</svg>`;
  return { svg, width, height };
}
