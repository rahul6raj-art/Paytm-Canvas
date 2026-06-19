import { NextResponse } from "next/server";
import path from "node:path";
import { importBridgeFromLivePreview } from "@/lib/craftBridge/bridgeLiveImport";
import { normalizeBridgeImportSlice } from "@/lib/craftBridge/normalizeBridgeImportSlice";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";
import { readSourceFile, resolvePageSource, toRepoRelativePaths } from "@paytm-craft/bridge";
import { defaultCaptureColorTheme } from "@/lib/webImport/captureTheme";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReimportLiveBody = {
  repoRoot: string;
  sourcePath: string;
  previewUrl: string;
};

/** Re-import linked screen via live Playwright capture (preserves pixel-accurate layers). */
export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as ReimportLiveBody;
    const repoRoot = body.repoRoot?.trim();
    const sourcePath = body.sourcePath?.trim();
    const previewUrl = body.previewUrl?.trim();
    if (!repoRoot || !sourcePath || !previewUrl) {
      return NextResponse.json(
        { error: "repoRoot, sourcePath, and previewUrl are required." },
        { status: 400 },
      );
    }

    const abs = path.resolve(repoRoot, sourcePath);
    const resolved = resolvePageSource(abs);
    const tsxRel = path.relative(repoRoot, resolved.tsxPath).replace(/\\/g, "/");
    const tsxRead = readSourceFile(repoRoot, tsxRel);
    if (!tsxRead.ok) {
      return NextResponse.json({ error: tsxRead.error }, { status: 404 });
    }

    const cssRelPaths = toRepoRelativePaths(repoRoot, resolved.cssPaths);
    const companionCss: string[] = [];
    for (const rel of cssRelPaths) {
      const cssRead = readSourceFile(repoRoot, rel);
      if (cssRead.ok) companionCss.push(cssRead.content);
    }

    const live = await importBridgeFromLivePreview({
      previewUrl,
      sourceCode: tsxRead.content,
      fileName: path.basename(resolved.tsxPath),
      cssSources: companionCss,
      theme: defaultCaptureColorTheme(),
    });
    if (!live.ok) {
      return NextResponse.json({ error: live.error }, { status: 503 });
    }

    const slice = normalizeBridgeImportSlice(live.slice);

    return NextResponse.json({
      ok: true,
      slice,
      componentName: live.componentName,
      message: live.message,
      sourceHeader: live.sourceHeader,
      hash: tsxRead.hash,
    });
  } catch (e) {
    console.error("[craft-bridge/reimport-live]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Live re-import failed." },
      { status: 500 },
    );
  }
}
