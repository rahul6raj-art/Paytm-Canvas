import { NextResponse } from "next/server";
import { FigmaApiError, getFigmaMe } from "@/integrations/figma/figma-api";
import {
  getFigmaServerAccessToken,
  hasFigmaServerAccessToken,
} from "@/integrations/figma/figma-server-env";

export const runtime = "nodejs";

/** Whether the server has FIGMA_ACCESS_TOKEN configured (no secret values returned). */
export async function GET() {
  const serverTokenConfigured = hasFigmaServerAccessToken();
  let serverUser: { id: string; email: string; handle: string; imgUrl?: string } | null = null;

  if (serverTokenConfigured) {
    try {
      const me = await getFigmaMe(getFigmaServerAccessToken());
      serverUser = {
        id: me.id,
        email: me.email,
        handle: me.handle,
        imgUrl: me.img_url,
      };
    } catch (e) {
      if (!(e instanceof FigmaApiError)) console.error("[import-figma/config]", e);
    }
  }

  const serverTokenValid = Boolean(serverUser);
  return NextResponse.json({
    serverTokenConfigured,
    serverTokenValid,
    serverUser,
  });
}
