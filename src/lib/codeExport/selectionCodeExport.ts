import type { EditorAsset } from "@/lib/documentPersistence";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";
import { collectSubtreeForExport } from "@/lib/codeRoundTrip/collectSubtree";
import { nodeToJsx } from "@/lib/codeRoundTrip/reactExport";
import { sanitizeComponentName } from "@/lib/codeRoundTrip/reactStyle";
import { frameDimensionsForExport, pickCodeExportRootIds } from "./frameRelativeExport";
import { nodeToHtml } from "./htmlExport";

export type CodePanelFormat = "html" | "react";

export type SelectionCodeExportInput = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  selectedIds: string[];
  designTokens: Record<string, DesignToken>;
  assets: Record<string, EditorAsset>;
  format: CodePanelFormat;
};

export type SelectionCodeExportResult = {
  code: string;
  format: CodePanelFormat;
  exportRootIds: string[];
  rootLabel: string;
  layerCount: number;
  wrapperWidth: number;
  wrapperHeight: number;
  empty: boolean;
};

export function exportSelectionCode(input: SelectionCodeExportInput): SelectionCodeExportResult {
  const exportRootIds = pickCodeExportRootIds(
    input.selectedIds,
    input.nodes,
    input.childOrder,
  );
  const { nodes, childOrder } = collectSubtreeForExport(
    exportRootIds,
    input.nodes,
    input.childOrder,
  );

  const layerCount = Object.keys(nodes).length;
  const empty = exportRootIds.length === 0 || layerCount === 0;
  const rootId = exportRootIds[0];
  const rootNode = rootId ? nodes[rootId] : undefined;
  const { width: wrapperWidth, height: wrapperHeight } = rootId
    ? frameDimensionsForExport(rootId, nodes)
    : { width: 390, height: 844 };

  const rootLabel = rootNode?.name ?? "Selection";

  if (empty || !rootId) {
    return {
      code: "",
      format: input.format,
      exportRootIds,
      rootLabel: "Nothing selected",
      layerCount: 0,
      wrapperWidth,
      wrapperHeight,
      empty: true,
    };
  }

  const frameRootOpts = {
    portable: true as const,
    isFrameRoot: true,
    isPcRoot: true,
    pcRootId: rootId,
  };

  const body =
    input.format === "react"
      ? nodeToJsx(rootNode!, nodes, childOrder, input.designTokens, 2, frameRootOpts)
      : nodeToHtml(rootNode!, nodes, childOrder, input.designTokens, 2, frameRootOpts);

  const componentName = sanitizeComponentName(rootNode?.name ?? "Selection");

  const code =
    input.format === "react"
      ? `"use client";

import React from "react";

/** Screen frame at (0,0) in code · ${layerCount} layer(s) · positions are relative to this frame */
export default function ${componentName}() {
  return (
${body}  );
}
`
      : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${componentName}</title>
  <!-- Screen frame at (0,0) · ${layerCount} layer(s) · child positions relative to frame -->
</head>
<body style="margin: 0;">
${body}
</body>
</html>
`;

  return {
    code,
    format: input.format,
    exportRootIds,
    rootLabel,
    layerCount,
    wrapperWidth,
    wrapperHeight,
    empty: false,
  };
}

/** @deprecated Use pickCodeExportRootIds — always resolves to enclosing frame */
export { pickCodeExportRootIds as pickExportRootIds } from "./frameRelativeExport";
