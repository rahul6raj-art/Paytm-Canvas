/** Recursive layout pass — delegates to `@/lib/layoutEngine/layoutAutoNode`. */
export {
  layoutAutoNode as layoutAutoLayoutNode,
  layoutAutoNodeDeep as layoutAutoLayoutNodeDeep,
  layoutableChildIds,
  flowChildIds,
  sortIdsForAutoLayoutFlow,
  applyLayoutResult,
} from "@/lib/layoutEngine/layoutAutoNode";
