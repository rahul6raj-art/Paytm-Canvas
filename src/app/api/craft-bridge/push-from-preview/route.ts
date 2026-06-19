import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";
import { bridgeCorsHeaders, jsonWithBridgeCors } from "@/lib/craftBridge/bridgeCors";
import { resolvePreviewPushLink } from "@/lib/craftBridge/resolvePreviewPushLink";
import { runBridgePageImport } from "@/lib/craftBridge/runBridgePageImport";

export const runtime = "nodejs";
export const maxDuration = 60;

type PushFromPreviewBody = {
  previewUrl?: string;
  repoRoot?: string;
};

export async function OPTIONS(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) {
    return new Response(null, { status: denied.status, headers: bridgeCorsHeaders(req) });
  }
  return new Response(null, { status: 204, headers: bridgeCorsHeaders(req) });
}

export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) {
    return new Response(denied.body, {
      status: denied.status,
      headers: { ...bridgeCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as PushFromPreviewBody;
    const previewUrl = body.previewUrl?.trim();
    let repoRoot = body.repoRoot?.trim();

    if (!previewUrl) {
      return jsonWithBridgeCors(req, { error: "previewUrl is required." }, { status: 400 });
    }

    if (!repoRoot) {
      return jsonWithBridgeCors(
        req,
        { error: "repoRoot is required. Re-run craft-bridge install-preview-menu." },
        { status: 400 },
      );
    }

    const resolved = resolvePreviewPushLink(repoRoot, previewUrl);
    if (!resolved.ok) {
      return jsonWithBridgeCors(req, { error: resolved.error }, { status: 404 });
    }

    const imported = await runBridgePageImport({
      repoRoot: resolved.repoRoot,
      pagePath: resolved.pagePath,
      previewUrl: resolved.captureUrl,
    });

    if (!imported.ok) {
      return jsonWithBridgeCors(req, { error: imported.error }, { status: imported.status });
    }

    return jsonWithBridgeCors(req, {
      ok: true,
      pendingId: imported.pendingId,
      componentName: imported.componentName,
      message: imported.message,
      layerCount: imported.layerCount,
      pagePath: resolved.pagePath,
      screen: previewUrl,
      openUrl: "/editor",
    });
  } catch (e) {
    console.error("[craft-bridge/push-from-preview]", e);
    return jsonWithBridgeCors(
      req,
      { error: e instanceof Error ? e.message : "Push from preview failed." },
      { status: 500 },
    );
  }
}
