import type { EditorNode } from "@/stores/useEditorStore";

/** Map SVG `stroke-dasharray` to editor stroke dash fields. */
export function dashFromSvgStrokeDasharray(
  raw: string | undefined,
): Pick<EditorNode, "strokeStyle" | "strokeDashLength" | "strokeDashGap"> | null {
  if (!raw?.trim() || raw.trim() === "none") return null;
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map((v) => parseFloat(v))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  const dash = Math.abs(parts[0] ?? 0);
  const gap = Math.abs(parts[1] ?? parts[0] ?? 0);
  if (dash <= 0) return { strokeStyle: "solid" };
  const strokeStyle: EditorNode["strokeStyle"] =
    gap > 0 && dash <= gap * 0.6 ? "dotted" : "dashed";
  return { strokeStyle, strokeDashLength: dash, strokeDashGap: gap > 0 ? gap : dash };
}
