import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { CodePanelFormat } from "@/lib/codeExport/selectionCodeExport";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { importCodeSource } from "./index";

export type CodeToCanvasResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      componentName: string;
      message: string;
      sourceHeader?: string;
      codeRoundTripLink?: CodeRoundTripLink | null;
      layerCount: number;
    }
  | { ok: false; error: string };

type ApiSuccess = {
  ok: true;
  slice: EditorPersistSlice;
  componentName: string;
  message: string;
  sourceHeader?: string;
  codeRoundTripLink?: CodeRoundTripLink | null;
  layerCount: number;
};

/** Parse React/HTML source into an editor slice (server API first, client fallback). */
export async function parseCodeToCanvasSlice(
  source: string,
  format: CodePanelFormat,
  opts?: { fileName?: string; companionCss?: string[] },
): Promise<CodeToCanvasResult> {
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste your full .tsx file (imports through export default)." };
  }

  try {
    const res = await fetch("/api/code-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: trimmed,
        format,
        fileName: opts?.fileName,
        companionCss: opts?.companionCss,
      }),
    });
    const body = (await res.json()) as ApiSuccess | { error?: string };
    if (res.ok && "slice" in body && body.slice) {
      return {
        ok: true,
        slice: body.slice,
        componentName: body.componentName,
        message: body.message,
        sourceHeader: body.sourceHeader,
        codeRoundTripLink: body.codeRoundTripLink ?? null,
        layerCount: body.layerCount ?? Object.keys(body.slice.nodes).length,
      };
    }
    if (!res.ok && "error" in body && body.error) {
      return { ok: false, error: body.error };
    }
  } catch {
    /* offline / API unavailable — parse in-browser */
  }

  const local = importCodeSource(trimmed, format, {
    fileName: opts?.fileName,
    companionCss: opts?.companionCss,
  });
  if (!local.ok) return local;
  return {
    ok: true,
    slice: local.slice,
    componentName: local.componentName,
    message: local.message,
    sourceHeader: local.sourceHeader,
    codeRoundTripLink: local.codeRoundTripLink ?? null,
    layerCount: Object.keys(local.slice.nodes).length,
  };
}
