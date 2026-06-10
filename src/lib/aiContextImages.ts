import type { AIContextAttachment } from "@/lib/aiGenerateContext";

export type AIContextImagePayload = {
  name: string;
  mimeType: string;
  /** `data:image/...;base64,...` for OpenAI vision. */
  dataUrl: string;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

/** Read attached image previews as base64 payloads for multimodal API calls (browser only). */
export async function extractContextImagesForApi(
  attachments: AIContextAttachment[],
): Promise<AIContextImagePayload[]> {
  const images = attachments.filter((a) => a.kind === "image" && a.status === "ready" && a.previewUrl);
  const out: AIContextImagePayload[] = [];

  for (const img of images) {
    try {
      const res = await fetch(img.previewUrl!);
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl.startsWith("data:image/")) continue;
      out.push({
        name: img.name,
        mimeType: blob.type || "image/png",
        dataUrl,
      });
    } catch {
      /* skip unreadable preview */
    }
  }

  return out;
}
