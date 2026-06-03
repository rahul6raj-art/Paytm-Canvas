import { NextResponse } from "next/server";
import { FigmaApiError, getFigmaMe } from "@/integrations/figma/figma-api";
import { resolveFigmaAccessToken } from "@/integrations/figma/figma-import-service";

export const runtime = "nodejs";

type VerifyBody = { accessToken?: string };

/** Validate a Figma PAT (or server token) and return the real account profile. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerifyBody;
    const token = resolveFigmaAccessToken(body.accessToken);
    const user = await getFigmaMe(token);
    const fromServer = !body.accessToken?.trim();
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        imgUrl: user.img_url,
        source: fromServer ? "server" : "personal",
      },
    });
  } catch (e) {
    if (e instanceof FigmaApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
    }
    console.error("[import-figma/verify]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not verify Figma token." },
      { status: 500 },
    );
  }
}
