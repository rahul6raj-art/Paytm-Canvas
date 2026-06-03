import { getEditorClipboardJson } from "@/lib/editorClipboardBuffer";
import { parseEditorClipboardPayload } from "@/lib/editorClipboardPayload";

export function hasEditorClipboardContent(): boolean {
  const raw = getEditorClipboardJson();
  if (!raw) return false;
  const p = parseEditorClipboardPayload(raw);
  return Boolean(p?.rootIds?.length);
}
