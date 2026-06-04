export type {
  CanvasInteractionMode,
  EditHandle,
  EditHandleContext,
  EditHandleDragInput,
  EditHandleKind,
} from "./types";
export { getEditHandles, updateFromHandle } from "./editHandles";
export {
  resolveCanvasInteractionMode,
  isInEditMode,
  type InteractionModeInput,
} from "./interactionMode";
export {
  canEnterParametricShapeEdit,
  isShapeParametricEditActive,
  shouldEnterPathEditOnEdit,
  type ShapeEditGateState,
} from "./shapeEditGate";
