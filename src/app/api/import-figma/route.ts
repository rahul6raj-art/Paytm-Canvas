import { NextResponse } from "next/server";
import { FigmaApiError } from "@/integrations/figma/figma-api";
import { importFigmaFromRestApi } from "@/integrations/figma/figma-import-service";
import { resolveFigmaAccessToken } from "@/integrations/figma/figma-import-service";
import type { ImportFigmaApiRequest } from "@/integrations/figma/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImportFigmaApiRequest;

    try {
      resolveFigmaAccessToken(body.accessToken);
    } catch {
      return NextResponse.json(
        { error: "Figma access token is required. Set FIGMA_ACCESS_TOKEN on the server or paste a personal access token." },
        { status: 400 },
      );
    }

    const result = await importFigmaFromRestApi({
      accessToken: body.accessToken,
      url: body.url,
      fileKey: body.fileKey,
      nodeId: body.nodeId,
      embedImages: true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ document: result.document });
  } catch (e) {
    if (e instanceof FigmaApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
    console.error("[import-figma]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Figma import failed." },
      { status: 500 },
    );
  }
}
