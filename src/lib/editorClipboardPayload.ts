import type { EditorAsset } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";

export const EDITOR_CLIPBOARD_VERSION = 1 as const;

export type EditorClipboardPayloadV1 = {
  version: typeof EDITOR_CLIPBOARD_VERSION;
  rootIds: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets?: Record<string, EditorAsset>;
};

export function parseEditorClipboardPayload(raw: string): EditorClipboardPayloadV1 | null {
  try {
    const o = JSON.parse(raw) as EditorClipboardPayloadV1;
    if (!o || o.version !== EDITOR_CLIPBOARD_VERSION || !Array.isArray(o.rootIds) || !o.nodes || !o.childOrder) return null;
    return o;
  } catch {
    return null;
  }
}
