import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import { importReactFromJsx } from "./reactJsxToGraph";
import {
  CODE_PAYLOAD_END,
  CODE_PAYLOAD_START,
  type CodeRoundTripPayloadV1,
} from "./types";

export type ReactImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      componentName: string;
      message: string;
      sourceHeader?: string;
    }
  | { ok: false; error: string };

function extractPayloadJson(source: string): string | null {
  const start = source.indexOf(CODE_PAYLOAD_START);
  const end = source.indexOf(CODE_PAYLOAD_END);
  if (start < 0 || end < 0 || end <= start) return null;
  return source.slice(start + CODE_PAYLOAD_START.length, end).trim();
}

export function parseCodeRoundTripPayload(source: string): CodeRoundTripPayloadV1 | null {
  const json = extractPayloadJson(source);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as CodeRoundTripPayloadV1;
    if (parsed?.version !== 1 || !parsed.nodes || !parsed.childOrder) return null;
    return parsed;
  } catch {
    return null;
  }
}

function payloadToSlice(payload: CodeRoundTripPayloadV1): EditorPersistSlice {
  const rootIds = payload.exportRootIds.filter((id) => payload.nodes[id]);
  const childOrder = { ...payload.childOrder };
  childOrder[EDITOR_ROOT_KEY] = rootIds;

  return wrapPersistSliceWithPages({
    nodes: payload.nodes,
    childOrder,
    assets: payload.assets ?? {},
    designTokens: payload.designTokens ?? {},
    fileName: payload.componentName,
    selectedIds: rootIds,
    zoom: 1,
    pan: { x: 0, y: 0 },
    showGrid: true,
    showRulers: true,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    comments: [],
  });
}

/** Explain why import failed — helps when users paste a normal React repo file. */
export function diagnoseImportFailure(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return "Paste the full file from Canvas → React export (not just a component snippet).";
  }

  const hasStart = trimmed.includes(CODE_PAYLOAD_START);
  const hasEnd = trimmed.includes(CODE_PAYLOAD_END);
  const looksLikeAppSource =
    /^import\s+/m.test(trimmed) ||
    /from\s+["']react["']/i.test(trimmed) ||
    /from\s+["']@\/components/i.test(trimmed) ||
    /from\s+["']\.\.\//m.test(trimmed);

  if (!hasStart && !hasEnd && looksLikeAppSource) {
    return [
      "Could not parse this React file into layers.",
      "",
      "Make sure the file exports a component with JSX, for example:",
      "  export default function MyScreen() { return ( <div>...</div> ); }",
      "",
      "Custom components (e.g. <Header />) become editable frames. Intrinsic elements (div, p, img) map to layers with inline styles.",
      "",
      "For a lossless round-trip after editing, re-import the full file from Canvas → React export (includes @paytm-craft-payload).",
    ].join("\n");
  }

  if (hasStart && !hasEnd) {
    return "Found @paytm-craft-payload-start but not @paytm-craft-payload-end. Paste the complete export file without truncating the top section.";
  }

  if (!hasStart && hasEnd) {
    return "Found @paytm-craft-payload-end but not @paytm-craft-payload-start. Paste the complete export from Canvas → React.";
  }

  if (hasStart && hasEnd) {
    return "The payload block is present but the JSON inside is invalid or incomplete. Re-export from the canvas and try again without editing the payload section.";
  }

  return [
    "Could not find a valid @paytm-craft-payload block.",
    "",
    "Export from the canvas first (Canvas → React tab), then paste the full .tsx file here.",
    "Do not remove the comment block between @paytm-craft-payload-start and @paytm-craft-payload-end.",
  ].join("\n");
}

export function importReactSource(
  source: string,
  opts?: { fileName?: string },
): ReactImportResult {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: diagnoseImportFailure("") };
  }

  const payload = parseCodeRoundTripPayload(trimmed);
  if (payload) {
    const rootIds = payload.exportRootIds.filter((id) => payload.nodes[id]);
    if (rootIds.length === 0) {
      return { ok: false, error: "Payload has no export roots." };
    }

    const slice = payloadToSlice(payload);
    if (opts?.fileName) slice.fileName = opts.fileName;

    return {
      ok: true,
      slice,
      componentName: payload.componentName,
      sourceHeader: payload.sourceHeader,
      message: `Imported ${Object.keys(payload.nodes).length} layers from React (${payload.componentName}).`,
    };
  }

  const jsxResult = importReactFromJsx(trimmed, { fileName: opts?.fileName });
  if (jsxResult.ok) {
    return {
      ok: true,
      slice: jsxResult.slice,
      componentName: jsxResult.payload.componentName,
      sourceHeader: jsxResult.payload.sourceHeader,
      message: jsxResult.message,
    };
  }

  return { ok: false, error: jsxResult.error || diagnoseImportFailure(trimmed) };
}
