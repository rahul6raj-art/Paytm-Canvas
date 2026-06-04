import type { EditorNode } from "@/stores/useEditorStore";

/** High-level canvas interaction modes (Figma-aligned). */
export type CanvasInteractionMode =
  | "select"
  | "move"
  | "resize"
  | "rotate"
  | "edit"
  | "textEdit";

export type EditHandleKind =
  | "cornerRadius"
  | "ellipseArcStart"
  | "ellipseArcEnd"
  | "ellipseArcSweep"
  | "ellipseArcRatio"
  | "polygonSides"
  | "polygonCornerRadius"
  | "starRatio"
  | "starCornerRadius"
  | "lineStart"
  | "lineEnd"
  | "lineBody"
  | "arrowStartCap"
  | "arrowEndCap"
  | "arrowHeadSize"
  | "pathAnchor"
  | "pathHandleIn"
  | "pathHandleOut";

/** Descriptor for a shape-specific edit handle (world space). */
export type EditHandle = {
  id: string;
  kind: EditHandleKind;
  /** Position in node-local coordinates (unrotated box). */
  local: { x: number; y: number };
  label?: string;
  meta?: Record<string, string | number>;
};

export type EditHandleContext = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  /** Optional live preview overrides keyed by handle kind. */
  preview?: Record<string, unknown>;
};

export type EditHandleDragInput = {
  handleId: string;
  kind: EditHandleKind;
  /** Pointer position in node-local space. */
  localX: number;
  localY: number;
  /** Shift / alt modifiers during drag. */
  shiftKey?: boolean;
  altKey?: boolean;
  meta?: Record<string, string | number>;
};
