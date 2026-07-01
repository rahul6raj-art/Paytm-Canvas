import { collectSubtreeForExport } from "@/lib/codeRoundTrip/collectSubtree";
import { buildCodeRoundTripPayload } from "@/lib/codeRoundTrip/reactExport";
import { extractSourceHeader } from "@/lib/codeRoundTrip/reactJsxToGraph";
import { sanitizeComponentName } from "@/lib/codeRoundTrip/reactStyle";
import {
  CODE_PAYLOAD_END,
  CODE_PAYLOAD_START,
  formatCodeRoundTripPayloadBlock,
} from "@/lib/codeRoundTrip/types";
import { findBridgeScreenRootForSource } from "@/lib/craftBridge/exportCanvasAdditions";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

function componentNameFromSource(source: string, fallback: string): string {
  const named =
    source.match(/export\s+(?:default\s+)?(?:const|function)\s+(\w+)/)?.[1] ??
    source.match(/export\s+\{\s*(\w+)\s*\}/)?.[1];
  return sanitizeComponentName(named ?? fallback);
}

/** Remove an existing @paytm-craft-payload comment block before rewriting it. */
export function stripPayloadCommentBlock(source: string): string {
  const blockRe =
    /\/\*[\s\S]*?@paytm-craft-payload-start[\s\S]*?@paytm-craft-payload-end[\s\S]*?\*\//;
  return source.replace(blockRe, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function insertPayloadAfterSourceHeader(source: string, payloadBlock: string): string {
  const header = extractSourceHeaderForBridgeExport(source);
  if (!header) {
    return `${payloadBlock}\n\n${source}`.trim();
  }
  const idx = source.indexOf(header);
  if (idx < 0) {
    return `${payloadBlock}\n\n${source}`.trim();
  }
  const afterHeader = idx + header.length;
  const rest = source.slice(afterHeader).replace(/^\s+/, "");
  return `${source.slice(0, afterHeader)}\n\n${payloadBlock}\n\n${rest}`.trim();
}

function extractSourceHeaderForBridgeExport(source: string): string {
  const stripped = stripPayloadCommentBlock(source);
  const canvasIdx = stripped.indexOf("{/* @craft-canvas-additions:start */}");
  const cutoff = canvasIdx >= 0 ? canvasIdx : stripped.length;
  return extractSourceHeader(stripped.slice(0, cutoff));
}

/** Embed the full edited screen subtree for lossless canvas ↔ code round-trip. */
export function patchBridgeCanvasPayloadIntoSource(input: {
  sourceContent: string;
  sourcePath: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  designTokens: Record<string, DesignToken>;
  assets: Record<string, EditorAsset>;
  link: CodeRoundTripLink;
  sourceHeader?: string | null;
  fileName?: string;
}): string {
  const screenRootId = findBridgeScreenRootForSource(input.nodes, input.sourcePath);
  if (!screenRootId) return input.sourceContent;

  const subtree = collectSubtreeForExport(
    [screenRootId],
    input.nodes,
    input.childOrder,
  );
  if (subtree.exportRootIds.length === 0) return input.sourceContent;

  const componentName = componentNameFromSource(
    input.sourceContent,
    input.fileName ?? "Screen",
  );
  const header =
    input.sourceHeader?.trim() ||
    extractSourceHeaderForBridgeExport(input.sourceContent) ||
    undefined;

  const payload = buildCodeRoundTripPayload({
    nodes: subtree.nodes,
    childOrder: subtree.childOrder,
    selectedIds: [screenRootId],
    designTokens: input.designTokens,
    assets: input.assets,
    fileName: componentName,
    sourceHeader: header,
    codeRoundTripLink: input.link,
  });

  const payloadBlock = formatCodeRoundTripPayloadBlock(JSON.stringify(payload, null, 2));
  const stripped = stripPayloadCommentBlock(input.sourceContent);
  return insertPayloadAfterSourceHeader(stripped, payloadBlock);
}

export function sourceHasCraftPayload(source: string): boolean {
  return (
    source.includes(CODE_PAYLOAD_START) && source.includes(CODE_PAYLOAD_END)
  );
}
