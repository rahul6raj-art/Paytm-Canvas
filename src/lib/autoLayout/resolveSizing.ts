import {
  childCrossSizing,
  childMainSizing,
  sizingMode,
  type LayoutEngineNode,
  type LayoutMode,
  type LayoutSizingMode,
} from "@/lib/layoutEngine/types";

/** Resolve effective horizontal/vertical sizing for a child in its parent's flow. */
export function resolveChildSize(
  child: LayoutEngineNode,
  parentMode: Exclude<LayoutMode, "none">,
): { main: LayoutSizingMode; cross: LayoutSizingMode } {
  return {
    main: childMainSizing(child, parentMode),
    cross: childCrossSizing(child, parentMode),
  };
}

export { sizingMode, childMainSizing, childCrossSizing };
