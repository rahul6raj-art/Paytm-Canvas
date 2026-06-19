import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import type { EditorNode } from "@/stores/useEditorStore";

export const CODE_PAYLOAD_START = "@paytm-craft-payload-start";
export const CODE_PAYLOAD_END = "@paytm-craft-payload-end";

/** Payload markers must live inside a block comment so .ts/.tsx files stay valid. */
export function formatCodeRoundTripPayloadBlock(payloadJson: string): string {
  return `/*
${CODE_PAYLOAD_START}
${payloadJson}
${CODE_PAYLOAD_END}
*/`;
}

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
  /** Linked source file for bridge auto-sync. */
  codeRoundTripLink?: CodeRoundTripLink | null;
};
