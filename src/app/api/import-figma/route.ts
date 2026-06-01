import { NextResponse } from "next/server";
import type { ImportFigmaApiRequest } from "@/lib/figmaApi/figmaApiTypes";
import { FigmaApiError, fetchFigmaForImport, fetchFigmaImageUrls } from "@/lib/figmaApi/figmaApiFetch";
import { convertFigmaApiToPaytmCraft } from "@/lib/figmaApi/figmaApiToPaytmCraft";
import { imageRefFromPaints } from "@/lib/figmaApi/figmaPaintUtils";
import type { FigmaApiNode } from "@/lib/figmaApi/figmaApiTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

function collectImageRefs(node: FigmaApiNode, refs: Set<string>): void {
  const ref = imageRefFromPaints(node.fills);
  if (ref) refs.add(ref);
  for (const c of node.children ?? []) collectImageRefs(c, refs);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImportFigmaApiRequest;
    if (!body?.accessToken?.trim()) {
      return NextResponse.json({ error: "Figma access token is required." }, { status: 400 });
    }

    const fetched = await fetchFigmaForImport({
      accessToken: body.accessToken,
      url: body.url,
      fileKey: body.fileKey,
      nodeId: body.nodeId,
    });

    const imageRefs = new Set<string>();
    collectImageRefs(fetched.root, imageRefs);
    const imageUrlByRef = await fetchFigmaImageUrls(
      fetched.fileKey,
      [...imageRefs],
      body.accessToken,
    );

    const result = convertFigmaApiToPaytmCraft(
      fetched.root,
      fetched.fileName,
      imageUrlByRef,
    );

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
