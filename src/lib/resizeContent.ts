import type { EditorNode } from "@/stores/useEditorStore";
import type { Bounds, ResizeHandle, ResizeModifiers } from "@/lib/resize";
import { isCornerHandle } from "@/lib/resizeTransform";

function uniformScaleFactor(
  sx: number,
  sy: number,
  handle: ResizeHandle,
  modifiers: ResizeModifiers,
): number {
  if (modifiers.shiftKey) return Math.max(sx, sy);
  if (isCornerHandle(handle)) return Math.sqrt(Math.max(0, sx * sy));
  return Math.max(sx, sy);
}

function shouldScaleTextContent(handle: ResizeHandle, modifiers: ResizeModifiers): boolean {
  if (isCornerHandle(handle)) return true;
  return modifiers.shiftKey;
}

/** Scale nested content when proportional resize is applied to a container. */
export function scaleSubtreeContentPatches(
  rootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  sx: number,
  sy: number,
  uniform: number,
): Record<string, Partial<EditorNode>> {
  const out: Record<string, Partial<EditorNode>> = {};
  const stack = [...(childOrder[rootId] ?? [])];

  while (stack.length > 0) {
    const id = stack.pop()!;
    const n = nodes[id];
    if (!n || !n.visible || n.locked) continue;

    const patch: Partial<EditorNode> = {
      x: n.x * sx,
      y: n.y * sy,
      width: Math.max(1, n.width * sx),
      height: Math.max(1, n.height * sy),
    };

    if (n.type === "text") {
      const fs = n.fontSize ?? 13;
      const ls = n.letterSpacing ?? 0;
      patch.fontSize = Math.max(1, Math.round(fs * uniform * 100) / 100);
      if (ls !== 0) patch.letterSpacing = ls * uniform;
    }

    if (n.type === "path" && n.pathPoints?.length) {
      patch.pathPoints = n.pathPoints.map((p) => ({
        ...p,
        x: p.x * sx,
        y: p.y * sy,
      }));
    }

    if ((n.type === "rectangle" || n.type === "frame") && (n.cornerRadius ?? 0) > 0) {
      patch.cornerRadius = Math.max(0, (n.cornerRadius ?? 0) * uniform);
    }

    out[id] = patch;
    for (const cid of childOrder[id] ?? []) stack.push(cid);
  }

  return out;
}

export function buildResizeContentPatches(
  node: EditorNode,
  start: Bounds,
  next: Bounds,
  handle: ResizeHandle,
  modifiers: ResizeModifiers,
): Partial<EditorNode> {
  const sx = start.width > 0 ? next.width / start.width : 1;
  const sy = start.height > 0 ? next.height / start.height : 1;
  if (sx === 1 && sy === 1) return {};

  const uniform = uniformScaleFactor(sx, sy, handle, modifiers);
  const patches: Partial<EditorNode> = {};

  if (node.type === "text" && shouldScaleTextContent(handle, modifiers)) {
    const fs = node.fontSize ?? 13;
    const ls = node.letterSpacing ?? 0;
    patches.fontSize = Math.max(1, Math.round(fs * uniform * 100) / 100);
    if (ls !== 0) patches.letterSpacing = ls * uniform;
  }

  if (node.type === "path" && node.pathPoints?.length) {
    patches.pathPoints = node.pathPoints.map((p) => ({
      ...p,
      x: p.x * sx,
      y: p.y * sy,
    }));
  }

  if ((node.type === "rectangle" || node.type === "frame") && (node.cornerRadius ?? 0) > 0) {
    if (shouldScaleTextContent(handle, modifiers)) {
      patches.cornerRadius = Math.max(0, (node.cornerRadius ?? 0) * uniform);
    }
  }

  return patches;
}

export function shouldProportionalFrameScale(handle: ResizeHandle, modifiers: ResizeModifiers): boolean {
  return modifiers.shiftKey && isCornerHandle(handle);
}
