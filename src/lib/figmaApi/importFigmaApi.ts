import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import type { ImportFigmaApiRequest } from "@/lib/figmaApi/figmaApiTypes";

export async function importFigmaFromApi(
  request: ImportFigmaApiRequest,
): Promise<PaytmCraftDocument> {
  const res = await fetch("/api/import-figma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const json = (await res.json()) as { document?: PaytmCraftDocument; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Figma import failed (${res.status})`);
  }
  if (!json.document) throw new Error("No document returned from Figma import.");
  return json.document;
}
