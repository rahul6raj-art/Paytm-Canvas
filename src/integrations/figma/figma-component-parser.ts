import { newComponentId } from "@/lib/componentModel";
import type { FigmaApiNode } from "@/integrations/figma/types";
import type { EditorNode } from "@/stores/useEditorStore";

export type FigmaComponentIndexCtx = {
  figmaToEditor: Map<string, string>;
  componentMasters: Map<string, string>;
  editorId: (figmaId: string) => string;
};

/** Index component node ids before conversion so instances can link masters. */
export function indexFigmaComponentNodes(node: FigmaApiNode, ctx: FigmaComponentIndexCtx): void {
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    ctx.componentMasters.set(node.id, ctx.editorId(node.id));
  }
  for (const c of node.children ?? []) indexFigmaComponentNodes(c, ctx);
}

export function applyFigmaComponentToNode(
  base: EditorNode,
  node: FigmaApiNode,
  ctx: FigmaComponentIndexCtx,
): void {
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    const cmpId = newComponentId();
    base.isComponent = true;
    base.componentId = cmpId;
    ctx.componentMasters.set(node.id, base.id);
  }

  if (node.type === "INSTANCE" && node.componentId) {
    const master = ctx.componentMasters.get(node.componentId);
    if (master) base.sourceComponentId = master;
    else base.sourceComponentId = `figma-${node.componentId.replace(/:/g, "-")}`;
  }
}
