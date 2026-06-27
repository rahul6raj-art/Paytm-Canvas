import { NextResponse } from "next/server";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";
import { rehydrateProjectStorybookComponents } from "@/lib/craftBridge/projectStorybookComponents";
import { probeStorybookComponentCatalog, resolveStorybookBaseUrl } from "@/lib/craftBridge/storybookCatalog";
import type { EditorPersistSlice } from "@/lib/documentPersistence";

export const runtime = "nodejs";
export const maxDuration = 300;

type RehydrateStorybookBody = Pick<
  EditorPersistSlice,
  | "nodes"
  | "childOrder"
  | "assets"
  | "designTokens"
  | "projectCssSources"
  | "codeRoundTripLink"
  | "canvasColorMode"
  | "storybookUrl"
  | "storybookCatalogHash"
>;

/** Server-only Storybook sync — avoids pulling Playwright into the browser bundle. */
export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as RehydrateStorybookBody;
    if (!body.nodes || !body.childOrder) {
      return NextResponse.json({ error: "nodes and childOrder are required." }, { status: 400 });
    }

    const patch = await rehydrateProjectStorybookComponents(body);
    if (patch) {
      return NextResponse.json({ ok: true, patch });
    }

    const storybookUrl = (body.storybookUrl ?? resolveStorybookBaseUrl(body.codeRoundTripLink?.previewUrl)).replace(
      /\/$/,
      "",
    );
    const probe = await probeStorybookComponentCatalog(storybookUrl);
    if (!probe.ok) {
      return NextResponse.json({ ok: true, patch: null, hint: probe.error });
    }

    return NextResponse.json({
      ok: true,
      patch: null,
      hint:
        probe.stories.length > 0
          ? "Storybook catalog is up to date. Use Sync Storybook components to force a refresh."
          : undefined,
    });
  } catch (e) {
    console.error("[craft-bridge/rehydrate-storybook-components]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Storybook rehydrate failed." },
      { status: 503 },
    );
  }
}
