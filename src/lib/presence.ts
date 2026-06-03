import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { worldRect } from "@/lib/tree";

export type PresenceStatus = "viewing" | "editing" | "commenting" | "idle";

export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor: { x: number; y: number };
  selectedNodeIds: string[];
  status: PresenceStatus;
  lastSeenAt: string;
}

export interface PresenceActivityEntry {
  id: string;
  text: string;
  at: string;
}

export const MOCK_PRESENCE_TEMPLATES: Omit<PresenceUser, "cursor" | "selectedNodeIds" | "lastSeenAt">[] = [
  { id: "mock-aisha", name: "Aisha", color: "#f97316", status: "viewing" },
  { id: "mock-dev", name: "Dev", color: "#22c55e", status: "editing" },
  { id: "mock-meera", name: "Meera", color: "#a855f7", status: "viewing" },
  { id: "mock-priya", name: "Priya", color: "#0ea5e9", status: "idle" },
];

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}

/** Visible node ids under root (for mock selection). */
export function collectVisibleNodeIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootKey: string = EDITOR_ROOT_KEY,
): string[] {
  const out: string[] = [];
  const walk = (parentId: string) => {
    for (const id of childOrder[parentId] ?? []) {
      const n = nodes[id];
      if (!n || !n.visible) continue;
      out.push(id);
      walk(id);
    }
  };
  walk(rootKey);
  return out;
}

export function topLevelFrameCenters(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  rootKey: string = EDITOR_ROOT_KEY,
): { frameId: string; name: string; cx: number; cy: number }[] {
  const frames: { frameId: string; name: string; cx: number; cy: number }[] = [];
  for (const id of childOrder[rootKey] ?? []) {
    const n = nodes[id];
    if (!n?.visible || n.type !== "frame") continue;
    const wr = worldRect(id, nodes);
    frames.push({
      frameId: id,
      name: n.name,
      cx: wr.x + wr.width / 2,
      cy: wr.y + wr.height / 2,
    });
  }
  return frames;
}

export function filterExistingNodeIds(ids: string[], nodes: Record<string, EditorNode>): string[] {
  return ids.filter((id) => nodes[id] != null);
}
