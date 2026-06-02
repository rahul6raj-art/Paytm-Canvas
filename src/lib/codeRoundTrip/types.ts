import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

export const CODE_PAYLOAD_START = "@paytm-craft-payload-start";
export const CODE_PAYLOAD_END = "@paytm-craft-payload-end";

export type CodeRoundTripPayloadV1 = {
  version: 1;
  componentName: string;
  exportedAt: string;
  exportRootIds: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  designTokens: Record<string, DesignToken>;
  assets: Record<string, EditorAsset>;
  /** Preserved import lines from the uploaded file (re-emitted on export). */
  sourceHeader?: string;
};
