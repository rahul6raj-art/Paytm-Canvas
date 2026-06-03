import type { NodeKind } from "@/stores/useEditorStore";

export const PC_TYPE_ATTR = "data-pc-type";
export const PC_SHAPE_ATTR = "data-pc-shape";
export const PC_ID_ATTR = "data-pc-id";
export const PC_NAME_ATTR = "data-pc-name";
export const PC_COMPONENT_ATTR = "data-pc-component";
export const PC_ROOT_ATTR = "data-pc-root";

const VALID_NODE_KINDS = new Set<NodeKind>([
  "frame",
  "group",
  "rectangle",
  "ellipse",
  "line",
  "path",
  "text",
  "image",
]);

/** Resolve canvas layer type from exported HTML/React metadata attributes. */
export function parseNodeKindFromPcAttrs(
  pcType: string | null | undefined,
  legacyShape: string | null | undefined,
): NodeKind | undefined {
  const raw = (pcType ?? legacyShape)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (VALID_NODE_KINDS.has(raw as NodeKind)) return raw as NodeKind;
  return undefined;
}

export function isPaytmCraftRoundTripHtml(source: string): boolean {
  return source.includes(PC_ROOT_ATTR) || source.includes(PC_TYPE_ATTR) || source.includes(PC_ID_ATTR);
}
