import type {
  ConstraintHorizontal,
  ConstraintVertical,
  CrossAxisAlign,
  LayoutFields,
  LayoutMode,
  PrimaryAxisAlign,
} from "@/lib/autoLayout";
import type { LayoutSizingMode } from "@/stores/useEditorStore";
import type { FigmaApiNode, FigmaLayoutSizing } from "@/integrations/figma/types";

export function mapLayoutSizing(v: FigmaLayoutSizing | undefined): LayoutSizingMode | undefined {
  if (v === "HUG") return "hug";
  if (v === "FILL") return "fill";
  if (v === "FIXED") return "fixed";
  return undefined;
}

export function autoLayoutFromFigmaNode(node: FigmaApiNode): LayoutFields & {
  layoutSizingHorizontal?: LayoutSizingMode;
  layoutSizingVertical?: LayoutSizingMode;
} {
  const mode = node.layoutMode;
  if (!mode || mode === "NONE" || mode === "GRID") {
    return { layoutMode: "none" };
  }

  const layoutMode: LayoutMode = mode === "HORIZONTAL" ? "horizontal" : "vertical";
  const primaryAxisAlign = mapPrimaryAxisAlign(node.primaryAxisAlignItems);
  const counterAxisAlign = mapCounterAxisAlign(node.counterAxisAlignItems);

  const fields: LayoutFields & {
    layoutSizingHorizontal?: LayoutSizingMode;
    layoutSizingVertical?: LayoutSizingMode;
  } = {
    layoutMode,
    layoutGap: Math.max(0, node.itemSpacing ?? 0),
    paddingTop: node.paddingTop ?? 0,
    paddingRight: node.paddingRight ?? 0,
    paddingBottom: node.paddingBottom ?? 0,
    paddingLeft: node.paddingLeft ?? 0,
    primaryAxisAlign,
    counterAxisAlign,
    layoutSizingHorizontal: mapLayoutSizing(node.layoutSizingHorizontal),
    layoutSizingVertical: mapLayoutSizing(node.layoutSizingVertical),
  };

  if (node.primaryAxisSizingMode === "AUTO") {
    if (layoutMode === "horizontal") fields.layoutSizingHorizontal = "hug";
    else fields.layoutSizingVertical = "hug";
  }
  if (node.counterAxisSizingMode === "AUTO") {
    if (layoutMode === "horizontal") fields.layoutSizingVertical = "hug";
    else fields.layoutSizingHorizontal = "hug";
  }

  return fields;
}

function mapPrimaryAxisAlign(raw: string | undefined): PrimaryAxisAlign {
  switch (raw) {
    case "CENTER":
      return "center";
    case "MAX":
    case "END":
      return "end";
    case "SPACE_BETWEEN":
      return "space-between";
    default:
      return "start";
  }
}

function mapCounterAxisAlign(raw: string | undefined): CrossAxisAlign {
  switch (raw) {
    case "CENTER":
      return "center";
    case "MAX":
    case "END":
      return "end";
    case "STRETCH":
      return "stretch";
    default:
      return "start";
  }
}

export function constraintsFromFigma(node: FigmaApiNode): {
  constraintsHorizontal?: ConstraintHorizontal;
  constraintsVertical?: ConstraintVertical;
} {
  const h = node.constraints?.horizontal;
  const v = node.constraints?.vertical;
  const mapH = (x: string | undefined): ConstraintHorizontal | undefined => {
    switch (x) {
      case "LEFT":
        return "left";
      case "RIGHT":
        return "right";
      case "LEFT_RIGHT":
        return "left-right";
      case "CENTER":
        return "center";
      case "SCALE":
        return "scale";
      default:
        return undefined;
    }
  };
  const mapV = (x: string | undefined): ConstraintVertical | undefined => {
    switch (x) {
      case "TOP":
        return "top";
      case "BOTTOM":
        return "bottom";
      case "TOP_BOTTOM":
        return "top-bottom";
      case "CENTER":
        return "center";
      case "SCALE":
        return "scale";
      default:
        return undefined;
    }
  };
  return {
    constraintsHorizontal: mapH(h),
    constraintsVertical: mapV(v),
  };
}
