import { NextResponse } from "next/server";
import { importReactPageBundle } from "@/lib/codeRoundTrip/importReactPageBundle";
import { importHtmlPageBundle } from "@/lib/codeRoundTrip/importHtmlPageBundle";
import { importReactSource } from "@/lib/codeRoundTrip/reactImport";
import { importHtmlFromString } from "@/lib/codeImport/htmlImport";
import { importBridgeFromLivePreview } from "@/lib/craftBridge/bridgeLiveImport";
import { defaultCaptureColorTheme } from "@/lib/webImport/captureTheme";
import { writePendingImport } from "@paytm-craft/bridge";
import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { resolvePreviewCaptureUrl } from "@/lib/codeRoundTrip/derivePreviewCaptureUrl";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportSourceBody = {
  source: string;
  format?: "react" | "html";
  fileName?: string;
  companionCss?: string[];
  link?: Partial<CodeRoundTripLink>;
};

export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as ImportSourceBody;
    const source = body.source?.trim();
    if (!source) {
      return NextResponse.json({ error: "source is required." }, { status: 400 });
    }

    const format = body.format ?? (source.includes("<") && !source.includes("export ") ? "html" : "react");
    let slice: CraftBridgePendingImport["slice"] | undefined;
    let componentName = "";
    let message = "";
    let sourceHeader: string | undefined;

    const pageLabel =
      body.fileName?.replace(/\.[^.]+$/, "") ?? body.link?.sourcePath?.split("/").pop();
    const captureUrl = resolvePreviewCaptureUrl(body.link?.previewUrl, pageLabel);
    if (captureUrl && format === "react") {
      const live = await importBridgeFromLivePreview({
        previewUrl: captureUrl,
        sourceCode: source,
        fileName: body.fileName,
        cssSources: (body.companionCss ?? []).filter((c) => c?.trim()),
        theme: defaultCaptureColorTheme(),
      });
      if (live.ok) {
        slice = live.slice;
        componentName = live.componentName;
        message = live.message;
        sourceHeader = live.sourceHeader;
      } else {
        console.warn("[craft-bridge/import-source] live capture failed:", live.error);
        return NextResponse.json({ error: live.error }, { status: 503 });
      }
    }

    if (!slice) {
      if (format === "html") {
        const cssSources = (body.companionCss ?? []).filter((c) => c?.trim());
        const result =
          cssSources.length > 0
            ? importHtmlPageBundle({
                htmlSource: source,
                cssSources,
                fileName: body.fileName,
              })
            : importHtmlFromString(source, { fileName: body.fileName });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        slice = result.slice;
        componentName = result.componentName;
        message = message ? `${message} ${result.message}` : result.message;
        sourceHeader = result.sourceHeader;
      } else {
        const cssSources = (body.companionCss ?? []).filter((c) => c?.trim());
        const result =
          cssSources.length > 0
            ? importReactPageBundle({
                tsxSource: source,
                cssSources,
                fileName: body.fileName,
              })
            : importReactSource(source, { fileName: body.fileName });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        slice = result.slice;
        componentName = result.componentName;
        message = message ? `${message} ${result.message}` : result.message;
        sourceHeader = result.sourceHeader;
      }
    }

    if (!slice || Object.keys(slice.nodes).length === 0) {
      return NextResponse.json(
        { error: "No layers could be built from this source. Check preview URL and file content." },
        { status: 400 },
      );
    }

    const pending: CraftBridgePendingImport = {
      id: `bridge-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      slice,
      sourceHeader,
      message,
      link: body.link
        ? {
            sourcePath: body.link.sourcePath ?? "",
            repoRoot: body.link.repoRoot ?? "",
            cssPaths: body.link.cssPaths,
            previewUrl: body.link.previewUrl,
            syncMode: body.link.syncMode ?? "manual",
            watchSource: body.link.watchSource,
          }
        : undefined,
    };

    writePendingImport({
      ...pending,
      slice: pending.slice as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      ok: true,
      pendingId: pending.id,
      componentName,
      message,
      layerCount: Object.keys(slice.nodes).length,
      openUrl: "/editor",
    });
  } catch (e) {
    console.error("[craft-bridge/import-source]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed." },
      { status: 500 },
    );
  }
}
