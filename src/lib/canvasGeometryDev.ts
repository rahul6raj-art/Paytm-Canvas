import { isPaytmCraftDebugCanvas } from "@/lib/env";
import type { EditorNode } from "@/stores/useEditorStore";
import { worldRect } from "@/lib/tree";

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function warnInvalidNodeGeometry(
  context: string,
  id: string,
  node: Pick<EditorNode, "x" | "y" | "width" | "height">,
  nodes?: Record<string, EditorNode>,
): void {
  if (!isPaytmCraftDebugCanvas()) return;

  const issues: string[] = [];
  if (!isFiniteNum(node.x) || !isFiniteNum(node.y)) {
    issues.push(`x/y not finite (x=${node.x}, y=${node.y})`);
  }
  if (!isFiniteNum(node.width) || !isFiniteNum(node.height)) {
    issues.push(`width/height not finite (w=${node.width}, h=${node.height})`);
  } else {
    if (node.width < 0 || node.height < 0) {
      issues.push(`negative size (w=${node.width}, h=${node.height})`);
    }
  }

  if (nodes) {
    const wr = worldRect(id, { ...nodes, [id]: node as EditorNode });
    if (
      !isFiniteNum(wr.x) ||
      !isFiniteNum(wr.y) ||
      !isFiniteNum(wr.width) ||
      !isFiniteNum(wr.height) ||
      wr.width < 0 ||
      wr.height < 0
    ) {
      issues.push(
        `invalid worldRect (x=${wr.x}, y=${wr.y}, w=${wr.width}, h=${wr.height})`,
      );
    }
  }

  if (issues.length > 0) {
    console.warn(`[canvas-geometry] ${context} node=${id}: ${issues.join("; ")}`);
  }
}
