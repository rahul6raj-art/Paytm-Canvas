import { solidFromPaints } from "@/integrations/figma/figma-style-parser";
import type { FigmaApiNode } from "@/integrations/figma/types";
import type { EditorNode } from "@/stores/useEditorStore";

export function applyFigmaTextToNode(base: EditorNode, node: FigmaApiNode): void {
  if (base.type !== "text") return;
  const solid = solidFromPaints(node.fills);
  base.content = node.characters ?? "";
  const st = node.style;
  base.fontFamily = st?.fontFamily ? `"${st.fontFamily}", system-ui, sans-serif` : undefined;
  base.fontSize = st?.fontSize ?? 14;
  base.fontWeight = st?.fontWeight ?? 400;
  base.lineHeight = st?.lineHeightPx && st.fontSize ? st.lineHeightPx / st.fontSize : undefined;
  base.letterSpacing = st?.letterSpacing;
  base.textColor = solid.fill ?? "#111111";
  base.textAlign =
    st?.textAlignHorizontal === "CENTER"
      ? "center"
      : st?.textAlignHorizontal === "RIGHT"
        ? "right"
        : "left";
  base.textResizeMode = base.layoutSizingHorizontal === "hug" ? "auto-width" : "auto-height";
}
