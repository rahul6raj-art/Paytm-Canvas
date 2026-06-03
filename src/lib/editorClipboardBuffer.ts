const STORAGE_KEY = "paytm-craft:editor-clipboard-v1";

let memory: string | null = null;

export function setEditorClipboardJson(json: string): void {
  memory = json;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* quota / private mode */
  }
}

export function getEditorClipboardJson(): string | null {
  if (memory) return memory;
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  return null;
}

export function clearEditorClipboardMemory(): void {
  memory = null;
}
