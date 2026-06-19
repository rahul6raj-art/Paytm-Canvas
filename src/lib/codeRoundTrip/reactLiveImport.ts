import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { ImportWebResponse } from "@/lib/webImport/types";
import { importWebResponseToPersistSlice } from "@/lib/webImport/webImportToPersistSlice";
import type { ImportWebStep } from "@/lib/webImport/importWebApi";
import { IMPORT_WEB_STEPS } from "@/lib/webImport/importWebApi";
import type { EditorNode } from "@/stores/useEditorStore";
import { importReactFromJsx } from "./reactJsxToGraph";

export type ReactLiveImportInput = {
  previewUrl: string;
  /** Optional pasted .tsx — merges component tags (Header, PortfolioWidget) onto captured layers */
  sourceCode?: string;
  fileName?: string;
  viewport?: { width: number; height: number };
};

export type ReactLiveImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      message: string;
      sourceHeader?: string;
      componentName: string;
    }
  | { ok: false; error: string };

const PROGRESS_STEPS: ImportWebStep[] = ["loading", "screenshot", "extracting", "converting"];

/** Merge component tags from structure parse onto live-captured nodes (match by className). */
export function mergeStructureMetadataOntoLiveNodes(
  liveNodes: Record<string, EditorNode>,
  sourceCode: string,
): Record<string, EditorNode> {
  const parsed = importReactFromJsx(sourceCode);
  if (!parsed.ok) return liveNodes;

  const byClass = new Map<string, EditorNode>();
  for (const n of Object.values(parsed.slice.nodes)) {
    if (n.codeClassName) byClass.set(n.codeClassName, n);
  }

  const next: Record<string, EditorNode> = {};
  for (const [id, n] of Object.entries(liveNodes)) {
    const meta = n.codeClassName ? byClass.get(n.codeClassName) : undefined;
    if (meta) {
      next[id] = {
        ...n,
        codeJsxTag: meta.codeJsxTag ?? n.codeJsxTag,
        codeJsxIntrinsic: meta.codeJsxIntrinsic ?? n.codeJsxIntrinsic,
        name: meta.codeJsxTag && !meta.codeJsxIntrinsic ? meta.codeJsxTag : n.name,
      };
    } else {
      next[id] = n;
    }
  }
  return next;
}

function extractSourceHeader(source: string): string {
  const lines = source.split("\n");
  const header: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      t.startsWith("import ") ||
      t.startsWith("//") ||
      t.startsWith("/*") ||
      t === "" ||
      t.startsWith("*") ||
      t.startsWith('"use client"') ||
      t.startsWith("'use client'")
    ) {
      header.push(line);
      continue;
    }
    if (t.startsWith("export ") && !t.includes("function") && !t.includes("const")) continue;
    break;
  }
  return header.join("\n").trim();
}

/**
 * MagicPath-style import: capture the **rendered** React UI from a live preview URL
 * (Storybook, localhost, staging) and convert computed DOM → editable canvas layers.
 */
export async function importReactFromLivePreview(
  input: ReactLiveImportInput,
  onStep?: (step: ImportWebStep) => void,
): Promise<ReactLiveImportResult> {
  const viewport = input.viewport ?? { width: 390, height: 844 };

  onStep?.("launching");
  let progressIdx = 0;
  const progressTimer = onStep
    ? setInterval(() => {
        onStep(PROGRESS_STEPS[progressIdx % PROGRESS_STEPS.length]);
        progressIdx += 1;
      }, 10_000)
    : null;

  try {
    const res = await fetch("/api/import-react-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        previewUrl: input.previewUrl,
        viewport,
        mode: "editable",
      }),
    });

    const body = (await res.json()) as ImportWebResponse | { error: string };
    if (!res.ok) {
      const err = "error" in body ? body.error : `Capture failed (${res.status})`;
      return { ok: false, error: err };
    }

    onStep?.("building");

    let slice = importWebResponseToPersistSlice(body as ImportWebResponse);

    const sourceHeader = input.sourceCode?.trim()
      ? extractSourceHeader(input.sourceCode)
      : undefined;

    if (input.sourceCode?.trim()) {
      slice = {
        ...slice,
        nodes: mergeStructureMetadataOntoLiveNodes(slice.nodes, input.sourceCode),
        fileName:
          input.fileName?.replace(/\.[^.]+$/, "") ??
          slice.fileName,
      };
    }

    const count = Object.keys(slice.nodes).length;
    const componentName =
      input.fileName?.replace(/\.[^.]+$/, "") ?? slice.fileName;

    return {
      ok: true,
      slice,
      componentName,
      sourceHeader,
      message: `Captured ${count} editable layers from live preview (no background screenshot).`,
    };
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
}

export { IMPORT_WEB_STEPS };
