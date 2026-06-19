import { NextResponse } from "next/server";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";
import { runBridgePageImport } from "@/lib/craftBridge/runBridgePageImport";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportPageBody = {
  repoRoot: string;
  /** Page folder, index.ts, or main .tsx (relative to repoRoot). */
  pagePath: string;
  previewUrl?: string;
};

export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as ImportPageBody;
    const imported = await runBridgePageImport({
      repoRoot: body.repoRoot,
      pagePath: body.pagePath,
      previewUrl: body.previewUrl,
    });

    if (!imported.ok) {
      return NextResponse.json({ error: imported.error }, { status: imported.status });
    }

    return NextResponse.json({
      ok: true,
      pendingId: imported.pendingId,
      componentName: imported.componentName,
      message: imported.message,
      layerCount: imported.layerCount,
      cssPaths: imported.cssPaths,
      openUrl: "/editor",
    });
  } catch (e) {
    console.error("[craft-bridge/import-page]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed." },
      { status: 500 },
    );
  }
}
