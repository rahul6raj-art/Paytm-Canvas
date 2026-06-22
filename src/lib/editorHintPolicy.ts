/** Where hover hints are allowed in the editor UI. */
export type EditorHintPolicy = "full" | "shortcuts-only" | "none";

/** Override hint policy for a single control. */
export type EditorHintPriority = "always" | "never";

export function resolveEditorHintVisible({
  policy,
  priority,
  shortcut,
}: {
  policy: EditorHintPolicy;
  priority?: EditorHintPriority;
  shortcut?: string;
}): boolean {
  if (priority === "always") return true;
  if (priority === "never") return false;
  if (policy === "none") return false;
  if (policy === "shortcuts-only") return Boolean(shortcut?.trim());
  return true;
}
