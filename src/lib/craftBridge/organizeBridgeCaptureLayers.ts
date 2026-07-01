import type { EditorNode } from "@/stores/useEditorStore";

const GENERIC_LAYER_NAME =
  /^(?:div|frame|section|main|article|span|group|svg|wrapper|content|card|row|inner|outer|top-\d+|\d+)$/i;

/** BEM / component classes are kept as named layers in the tree. */
export function hasMeaningfulCaptureClass(cls: string | undefined): boolean {
  if (!cls?.trim()) return false;
  if (/__/.test(cls)) return true;
  return /\b(?:pml-|bn\b|sh-|li-item|ob-flow|header__|card\b|statusbar|textfield)\b/i.test(cls);
}

function pickLayerName(node: EditorNode): string | null {
  const cls = node.codeClassName?.trim();
  if (!cls) {
    const trimmed = node.name.trim();
    if (node.type === "text" && trimmed) return trimmed.slice(0, 48);
    return null;
  }
  const tokens = cls.split(/\s+/).filter(Boolean);
  const bem = tokens.find(
    (t) =>
      t.includes("__") ||
      t.startsWith("pml-") ||
      t === "bn" ||
      t.startsWith("bn__") ||
      t.startsWith("sh-") ||
      t.startsWith("li-item") ||
      t.startsWith("ob-flow"),
  );
  if (bem) return bem.slice(0, 48);
  const tag = node.codeJsxTag?.trim();
  if (tag && tag !== "div") return tag.slice(0, 48);
  return tokens[0]?.slice(0, 48) ?? null;
}

/** Replace auto Frame 42 / Div names with BEM class names from the source DOM. */
export function organizeBridgeCaptureLayerNames(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    const nextName = pickLayerName(node);
    if (!nextName) continue;
    const current = node.name.trim();
    if (!GENERIC_LAYER_NAME.test(current) && !/^frame\s*\d+$/i.test(current)) continue;
    nodes[id] = { ...node, name: nextName };
  }
}
