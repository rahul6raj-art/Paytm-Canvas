import { pickColorTokenFromPageCss } from "@/lib/colorTokenMatching";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

/** Layers that accept fill/stroke edits from the design panel. */
export function nodeCanReceiveFillStroke(node: EditorNode): boolean {
  return (
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path" ||
    node.type === "text" ||
    Boolean(node.isBooleanGroup)
  );
}

/** Visible, unlocked fill/stroke targets inside a group/frame (skips nested groups). */
export function collectContainerStyleTargets(
  containerId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode[] {
  const out: EditorNode[] = [];
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n || !n.visible || n.locked) return;
    if (n.type === "group") {
      for (const cid of childOrder[id] ?? []) walk(cid);
      return;
    }
    if (nodeCanReceiveFillStroke(n)) out.push(n);
  };
  for (const cid of childOrder[containerId] ?? []) walk(cid);
  return out;
}

/** Whether a container's children can be styled together (e.g. outlined text vectors). */
export function containerSupportsAggregateFillStroke(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  if (node.type !== "group" && node.type !== "frame") return false;
  if (node.isBooleanGroup) return false;
  return collectContainerStyleTargets(node.id, nodes, childOrder).length > 0;
}

/** Node stores its own fill (not only on descendants). */
export function nodeHasOwnPersistedBackgroundFill(node: EditorNode): boolean {
  if (node.type === "text") return false;
  if (node.fillTokenId) return true;
  return node.fillEnabled !== false && Boolean(node.fill?.trim());
}

/** Background resolves from imported page CSS on this layer. */
export function nodeHasCssBackgroundFill(
  node: EditorNode,
  tokens: Record<string, DesignToken>,
  cssSources: string[] | undefined,
): boolean {
  if (node.type === "text" || !cssSources?.length || !node.codeClassName?.trim()) return false;
  return Boolean(
    pickColorTokenFromPageCss(node.codeClassName, cssSources, tokens, [
      "background",
      "background-color",
    ]),
  );
}

/** Selected container paints its own background — do not aggregate to first text child. */
export function nodeHasOwnBackgroundFill(
  node: EditorNode,
  tokens?: Record<string, DesignToken>,
  cssSources?: string[],
): boolean {
  if (nodeHasOwnPersistedBackgroundFill(node)) return true;
  if (tokens && cssSources?.length) return nodeHasCssBackgroundFill(node, tokens, cssSources);
  return false;
}

function isAutoLayoutContainer(node: EditorNode): boolean {
  return (
    (node.type === "frame" || node.type === "group") && (node.layoutMode ?? "none") !== "none"
  );
}

function nodeHasInspectableFill(node: EditorNode): boolean {
  if (node.type === "text") {
    return node.fillEnabled !== false && Boolean((node.textColor ?? node.fill)?.trim());
  }
  return nodeHasOwnPersistedBackgroundFill(node);
}

function scoreFillStyleTarget(node: EditorNode): number {
  let score = 0;
  if (node.fillTokenId) score += 100;
  if (node.type === "rectangle" || node.type === "frame") score += 50;
  if (node.fillEnabled !== false && node.fill?.trim()) score += 30;
  if (node.type === "text") score -= 40;
  const cls = `${node.name ?? ""} ${node.codeClassName ?? ""}`.toLowerCase();
  if (/background|surface|theme-card|card|\bbn\b/.test(cls)) score += 25;
  return score;
}

/** Best fill layer inside a container (background rect, not label text). */
export function pickPrimaryFillStyleTarget(
  container: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode {
  const targets = collectContainerStyleTargets(container.id, nodes, childOrder);
  if (targets.length === 0) return container;
  const withFill = targets.filter(nodeHasInspectableFill);
  const pool = withFill.length > 0 ? withFill : targets;
  return [...pool].sort((a, b) => scoreFillStyleTarget(b) - scoreFillStyleTarget(a))[0]!;
}

function isOutlinedTextAggregate(targets: EditorNode[]): boolean {
  if (targets.length < 2) return false;
  return targets.every((t) => t.type === "path" || t.type === "rectangle");
}

export type FillStrokeStyleContext = {
  styleNode: EditorNode;
  aggregateStyleTargets: EditorNode[];
};

/** Resolve which layer the Fill/Stroke inspector should edit for the current selection. */
export function resolveFillStrokeStyleContext(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  tokens?: Record<string, DesignToken>,
  cssSources?: string[],
): FillStrokeStyleContext {
  if (nodeHasOwnBackgroundFill(node, tokens, cssSources)) {
    return { styleNode: node, aggregateStyleTargets: [] };
  }

  // Auto-layout containers: fill/stroke always target the frame, not the first child.
  if (isAutoLayoutContainer(node)) {
    return { styleNode: node, aggregateStyleTargets: [] };
  }

  if (!containerSupportsAggregateFillStroke(node, nodes, childOrder)) {
    return { styleNode: node, aggregateStyleTargets: [] };
  }

  const targets = collectContainerStyleTargets(node.id, nodes, childOrder);
  if (isOutlinedTextAggregate(targets)) {
    return { styleNode: targets[0]!, aggregateStyleTargets: targets };
  }

  const primary = pickPrimaryFillStyleTarget(node, nodes, childOrder);
  if (primary.id !== node.id) {
    return { styleNode: primary, aggregateStyleTargets: [primary] };
  }

  return { styleNode: node, aggregateStyleTargets: targets };
}

/** Expand a selected container to the layers that should receive fill/stroke edits. */
export function expandStyleTargetIds(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const n = nodes[nodeId];
  if (!n || !n.visible || n.locked) return [];
  const { aggregateStyleTargets, styleNode } = resolveFillStrokeStyleContext(n, nodes, childOrder);
  if (aggregateStyleTargets.length > 0) {
    return aggregateStyleTargets.map((t) => t.id);
  }
  if (nodeCanReceiveFillStroke(styleNode)) return [styleNode.id];
  return [];
}
