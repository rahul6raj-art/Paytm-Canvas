import { NextResponse } from "next/server";
import { craftBridgeGuard } from "@/lib/craftBridge/apiGuard";
import { importStorybookComponentsIntoSlice } from "@/lib/craftBridge/importStorybookComponents";
import { fetchLinkedCssTexts } from "@/lib/craftBridge/projectTokenCss";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import type { EditorPersistSlice } from "@/lib/documentPersistence";

export const runtime = "nodejs";
export const maxDuration = 300;

type ImportStorybookBody = {
  slice: EditorPersistSlice;
  link?: CodeRoundTripLink | null;
  storybookUrl?: string;
  force?: boolean;
  maxStories?: number;
};

/** Capture Components/* stories from Storybook into off-canvas component masters. */
export async function POST(req: Request) {
  const denied = craftBridgeGuard(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as ImportStorybookBody;
    if (!body.slice?.nodes || !body.slice.childOrder) {
      return NextResponse.json({ error: "slice with nodes and childOrder is required." }, { status: 400 });
    }

    const link = body.link ?? body.slice.codeRoundTripLink ?? null;
    let cssSources = body.slice.projectCssSources ?? [];
    if (cssSources.length === 0 && link?.repoRoot && link.cssPaths?.length) {
      cssSources = await fetchLinkedCssTexts(link);
    }

    const result = await importStorybookComponentsIntoSlice({
      slice: body.slice,
      link,
      storybookUrl: body.storybookUrl,
      cssSources,
      maxStories: body.maxStories,
    });

    return NextResponse.json({
      ok: true,
      slice: result.slice,
      storybookUrl: result.storybookUrl,
      catalogHash: result.catalogHash,
      imported: result.imported,
      skipped: result.skipped,
      storyCount: result.storyCount,
      totalImported: result.totalImported,
      remaining: result.remaining,
      message: result.message,
    });
  } catch (e) {
    console.error("[craft-bridge/import-storybook-components]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Storybook component import failed." },
      { status: 503 },
    );
  }
}
