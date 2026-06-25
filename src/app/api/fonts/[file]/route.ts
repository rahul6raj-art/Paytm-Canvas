import { readFile } from "fs/promises";
import path from "path";

const ALLOWED_FONT_FILES = new Set([
  "Inter-Regular.ttf",
  "Inter-Bold.ttf",
  "Roboto-Regular.ttf",
  "Roboto-Bold.ttf",
  "NotoSansArabic-Regular.ttf",
  "NotoSansDevanagari-Regular.ttf",
  "NotoSansBengali-Regular.ttf",
  "NotoSansTamil-Regular.ttf",
  "NotoSansHebrew-Regular.ttf",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await context.params;
  if (!ALLOWED_FONT_FILES.has(file)) {
    return new Response("Not found", { status: 404 });
  }
  const fontPath = path.join(process.cwd(), "packages/craft-engine/assets", file);
  try {
    const buffer = await readFile(fontPath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "font/ttf",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
