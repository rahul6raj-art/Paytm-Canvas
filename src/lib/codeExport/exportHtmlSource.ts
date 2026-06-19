import { nodeToHtml } from "@/lib/codeExport/htmlExport";
import {
  buildCodeRoundTripPayload,
  type ReactExportInput,
  type ReactExportResult,
} from "@/lib/codeRoundTrip/reactExport";
import { CODE_PAYLOAD_END, CODE_PAYLOAD_START } from "@/lib/codeRoundTrip/types";

/** Export linked HTML source with optional @paytm-craft-payload for lossless re-import. */
export function exportHtmlSource(input: ReactExportInput): ReactExportResult {
  const payload = buildCodeRoundTripPayload(input);
  const htmlOpts = input.codeRoundTripLink?.cssPaths?.length
    ? { preferPageCss: true as const, isFrameRoot: true, isPcRoot: true, pcRootId: payload.exportRootIds[0] }
    : { isFrameRoot: true, isPcRoot: true, pcRootId: payload.exportRootIds[0] };

  const body = payload.exportRootIds
    .map((rid) => {
      const n = payload.nodes[rid];
      return n
        ? nodeToHtml(n, payload.nodes, payload.childOrder, payload.designTokens, 2, htmlOpts)
        : "";
    })
    .join("");

  const payloadJson = JSON.stringify(payload, null, 2);
  const headExtras = payload.sourceHeader
    ? payload.sourceHeader
        .split("\n")
        .map((line) => (line.trim() ? `  ${line.trim()}` : ""))
        .filter(Boolean)
        .join("\n") + "\n"
    : "";

  const source = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--
${CODE_PAYLOAD_START}
${payloadJson}
${CODE_PAYLOAD_END}
-->
${headExtras}  <title>${payload.componentName}</title>
</head>
<body style="margin: 0;">
${body || "  <!-- Empty -->\n"}</body>
</html>
`;

  return {
    source,
    componentName: payload.componentName,
    exportRootIds: payload.exportRootIds,
    payload,
  };
}
