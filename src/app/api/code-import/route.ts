import { NextResponse } from "next/server";
import { importCodeSource } from "@/lib/codeImport";
import type { CodePanelFormat } from "@/lib/codeExport/selectionCodeExport";
import { looksLikeReactSource } from "@/lib/codeRoundTrip/reactImport";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

export const runtime = "nodejs";

type CodeImportBody = {
  source?: string;
  format?: CodePanelFormat;
  fileName?: string;
  /** Raw CSS file contents from the same page folder (e.g. PMLSignupPage.css). */
  companionCss?: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CodeImportBody;
    const source = body.source?.trim();
    if (!source) {
      return NextResponse.json({ error: "Paste your .tsx source code first." }, { status: 400 });
    }

    const format: CodePanelFormat =
      body.format === "html"
        ? looksLikeReactSource(source)
          ? "react"
          : "html"
        : body.format === "react"
          ? "react"
          : looksLikeReactSource(source)
            ? "react"
            : "html";

    const result = importCodeSource(source, format, {
      fileName: body.fileName,
      companionCss: body.companionCss,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const rootId = result.slice.childOrder[EDITOR_ROOT_KEY]?.[0];
    const root = rootId ? result.slice.nodes[rootId] : undefined;

    return NextResponse.json({
      ok: true,
      slice: result.slice,
      componentName: result.componentName,
      message: result.message,
      sourceHeader: result.sourceHeader,
      codeRoundTripLink: result.codeRoundTripLink ?? null,
      layerCount: Object.keys(result.slice.nodes).length,
      rootSize: root ? { width: root.width, height: root.height } : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Import failed: ${msg}` }, { status: 500 });
  }
}
