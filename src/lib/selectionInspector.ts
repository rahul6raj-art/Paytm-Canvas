import { topLevelSelectedIds } from "@/lib/editorGraph";
import { nodeFillDisplayHex, nodeSupportsFillColor } from "@/lib/fillAdjust";
import { shapeSupportsIndividualCornerRadius } from "@/lib/shapes/parametricCornerRadii";
import type { EditorNode } from "@/stores/useEditorStore";

export function getEditableTopLevelSelection(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): EditorNode[] {
  return topLevelSelectedIds(selectedIds, nodes)
    .map((id) => nodes[id])
    .filter((n): n is EditorNode => Boolean(n && !n.locked));
}

function allSame<T>(values: T[]): boolean {
  if (values.length <= 1) return true;
  const first = values[0];
  return values.every((v) => v === first);
}

function mixedFlag(values: unknown[]): boolean {
  return values.length > 1 && !allSame(values);
}

export type SelectionInspectorCaps = {
  canFillStroke: boolean;
  canRadius: boolean;
  showStrokeSides: boolean;
  canStroke: boolean;
  allText: boolean;
  anyText: boolean;
  allContainers: boolean;
};

export type SelectionInspectorMixed = {
  x: boolean;
  y: boolean;
  width: boolean;
  height: boolean;
  rotation: boolean;
  fillHex: boolean;
  opacity: boolean;
  cornerRadius: boolean;
  strokeWidth: boolean;
};

export type SelectionInspectorModel = {
  nodes: EditorNode[];
  primary: EditorNode;
  count: number;
  allLocked: boolean;
  caps: SelectionInspectorCaps;
  mixed: SelectionInspectorMixed;
  display: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
};

function nodeCanFillStroke(node: EditorNode): boolean {
  return (
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path" ||
    node.type === "text" ||
    Boolean(node.isBooleanGroup)
  );
}

function nodeCanStroke(node: EditorNode): boolean {
  return nodeCanFillStroke(node) || node.type === "line" || node.type === "arrow";
}

export function buildSelectionInspectorModel(
  selectedIds: string[],
  nodes: Record<string, EditorNode>,
): SelectionInspectorModel | null {
  const editable = getEditableTopLevelSelection(selectedIds, nodes);
  if (editable.length === 0) return null;

  const primary = editable[0]!;
  const xs = editable.map((n) => n.x);
  const ys = editable.map((n) => n.y);
  const ws = editable.map((n) => n.width);
  const hs = editable.map((n) => n.height);
  const rots = editable.map((n) => n.rotation ?? 0);
  const fillHexes = editable.filter(nodeSupportsFillColor).map(nodeFillDisplayHex);
  const opacities = editable.map((n) => n.opacity ?? 1);
  const cornerRadii = editable
    .filter(shapeSupportsIndividualCornerRadius)
    .map((n) => n.cornerRadius ?? 0);
  const strokeWidths = editable.filter(nodeCanStroke).map((n) => n.strokeWidth ?? 0);

  return {
    nodes: editable,
    primary,
    count: editable.length,
    allLocked: editable.every((n) => n.locked),
    caps: {
      canFillStroke: editable.some(nodeCanFillStroke),
      canRadius: editable.some(shapeSupportsIndividualCornerRadius),
      showStrokeSides: editable.some(
        (n) => n.type === "rectangle" || n.type === "frame",
      ),
      canStroke: editable.some(nodeCanStroke),
      allText: editable.every((n) => n.type === "text"),
      anyText: editable.some((n) => n.type === "text"),
      allContainers: editable.every((n) => n.type === "frame" || n.type === "group"),
    },
    mixed: {
      x: mixedFlag(xs),
      y: mixedFlag(ys),
      width: mixedFlag(ws),
      height: mixedFlag(hs),
      rotation: mixedFlag(rots),
      fillHex: mixedFlag(fillHexes),
      opacity: mixedFlag(opacities),
      cornerRadius: mixedFlag(cornerRadii),
      strokeWidth: mixedFlag(strokeWidths),
    },
    display: {
      x: primary.x,
      y: primary.y,
      width: primary.width,
      height: primary.height,
      rotation: primary.rotation ?? 0,
    },
  };
}
