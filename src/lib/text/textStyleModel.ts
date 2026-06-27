import type { EditorNode } from "@/stores/useEditorStore";
import {
  isAutoLineHeight,
  lineHeightUnitFromNode,
  resolveLineHeightPxFromNode,
} from "./lineHeight";
import type { LineHeightUnit } from "./lineHeight";
import {
  letterSpacingUnitFromNode,
  resolveLetterSpacingPxFromNode,
} from "./letterSpacing";
import type { LetterSpacingUnit } from "./letterSpacing";

export type LineHeight =
  | { mode: "auto" }
  | { mode: "px"; value: number }
  | { mode: "percent"; value: number };

export type LetterSpacing =
  | { mode: "px"; value: number }
  | { mode: "percent"; value: number };

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  lineHeight: LineHeight;
  letterSpacing?: LetterSpacing;
};

export function lineHeightFromNode(
  node: Pick<EditorNode, "lineHeight" | "lineHeightUnit" | "fontSize">,
): LineHeight {
  const unit = lineHeightUnitFromNode(node);
  if (unit === "auto" || isAutoLineHeight(node)) return { mode: "auto" };
  if (unit === "px") {
    return { mode: "px", value: node.lineHeight ?? node.fontSize ?? 14 };
  }
  const stored = node.lineHeight;
  const percent =
    stored == null
      ? 125
      : stored <= 4
        ? stored * 100
        : stored;
  return { mode: "percent", value: percent };
}

export function letterSpacingFromNode(
  node: Pick<EditorNode, "letterSpacing" | "letterSpacingUnit" | "fontSize">,
): LetterSpacing {
  const unit = letterSpacingUnitFromNode(node);
  const stored = node.letterSpacing ?? 0;
  if (unit === "percent") return { mode: "percent", value: stored };
  return { mode: "px", value: stored };
}

export function textStyleFromNode(
  node: Pick<
    EditorNode,
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "lineHeightUnit"
    | "letterSpacing"
    | "letterSpacingUnit"
  >,
): TextStyle {
  return {
    fontFamily: node.fontFamily ?? "Inter",
    fontSize: node.fontSize ?? 14,
    fontWeight: node.fontWeight,
    lineHeight: lineHeightFromNode(node),
    letterSpacing: letterSpacingFromNode(node),
  };
}

export function resolvedLineHeightPxForNode(
  node: Pick<EditorNode, "fontSize" | "lineHeight" | "lineHeightUnit" | "fontWeight" | "fontFamily">,
): number {
  return resolveLineHeightPxFromNode(node);
}

export function resolvedLetterSpacingPxForNode(
  node: Pick<EditorNode, "fontSize" | "letterSpacing" | "letterSpacingUnit">,
): number {
  return resolveLetterSpacingPxFromNode(node);
}

export type { LineHeightUnit, LetterSpacingUnit };
