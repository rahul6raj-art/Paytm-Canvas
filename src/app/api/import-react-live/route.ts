import { NextResponse } from "next/server";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import { runImportWebCapture } from "@/lib/webImport/server/playwrightCaptureService";
import { formatBrowserLaunchError } from "@/lib/webImport/server/launchPlaywrightBrowser";
import type { ImportWebRequest } from "@/lib/webImport/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReactLiveImportBody = {
  previewUrl: string;
  viewport: { width: number; height: number };
  mode?: "editable" | "editable_with_reference";
};

/**
 * MagicPath-style Web Capture: render URL in Playwright, extract computed DOM + styles.
 * Allows localhost / Storybook (unlike public web import).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReactLiveImportBody;
    if (!body?.previewUrl?.trim()) {
      return NextResponse.json({ error: "previewUrl is required." }, { status: 400 });
    }

    const validated = validateReactPreviewUrl(body.previewUrl);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    if (!body.viewport?.width || !body.viewport?.height) {
      return NextResponse.json({ error: "viewport width and height are required." }, { status: 400 });
    }

    const request: ImportWebRequest = {
      url: validated.url,
      mode: body.mode ?? "editable",
      viewport: body.viewport,
      urlPolicy: "react-preview",
    };

    const result = await runImportWebCapture(request);
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("browser")
        ? formatBrowserLaunchError(e)
        : e instanceof Error
          ? e.message
          : "Live capture failed.";
    console.error("[import-react-live]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
