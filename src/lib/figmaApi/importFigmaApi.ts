import { FIGMA_API_IMPORT_TIMEOUT_MS } from "@/lib/figImport/figImportConstants";
import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import type { ImportFigmaApiRequest } from "@/integrations/figma/types";

export async function importFigmaFromApi(
  request: ImportFigmaApiRequest,
): Promise<PaytmCraftDocument> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FIGMA_API_IMPORT_TIMEOUT_MS);

  try {
    const res = await fetch("/api/import-figma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        ...request,
        url: request.url?.trim(),
        fileKey: request.fileKey?.trim(),
        nodeId: request.nodeId?.trim(),
        accessToken: request.accessToken?.trim(),
      }),
    });
    const json = (await res.json()) as { document?: PaytmCraftDocument; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? `Figma import failed (${res.status})`);
    }
    if (!json.document) throw new Error("No document returned from Figma import.");
    return json.document;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Figma import timed out. Try a single frame link (⌘L in Figma) or a smaller file.",
      );
    }
    throw e;
  } finally {
    window.clearTimeout(timeout);
  }
}
