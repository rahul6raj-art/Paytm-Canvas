import { NextResponse } from "next/server";
import type { ImportWebRequest } from "@/lib/webImport/types";
import { runImportWebCapture } from "@/lib/webImport/server/playwrightCaptureService";
import { formatBrowserLaunchError } from "@/lib/webImport/server/launchPlaywrightBrowser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ImportWebRequest;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.mode || !["editable", "screenshot", "editable_with_reference"].includes(body.mode)) {
      return NextResponse.json({ error: "Invalid import mode." }, { status: 400 });
    }

    if (!body.viewport?.width || !body.viewport?.height) {
      return NextResponse.json({ error: "Viewport width and height are required." }, { status: 400 });
    }

    const result = await runImportWebCapture(body);
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("browser")
        ? formatBrowserLaunchError(e)
        : e instanceof Error
          ? e.message
          : "Import failed.";
    console.error("[import-web]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
