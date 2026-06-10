import type { AIStyleId } from "@/lib/aiMockGenerator";
import { isValidAIModelId, normalizeAIModelId } from "@/lib/aiModels";
import { runAIGenerate } from "@/lib/aiGenerateService";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as {
    prompt?: string;
    preset?: string;
    style?: string;
    model?: string;
    contextPrompt?: string;
    contextAttachmentCount?: number;
    contextImages?: { name?: string; mimeType?: string; dataUrl?: string }[];
  };

  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  const preset = typeof payload.preset === "string" ? payload.preset : undefined;
  const model = normalizeAIModelId(payload.model);
  const contextPrompt =
    typeof payload.contextPrompt === "string" ? payload.contextPrompt : undefined;
  const contextAttachmentCount =
    typeof payload.contextAttachmentCount === "number" ? payload.contextAttachmentCount : undefined;
  const contextImages = Array.isArray(payload.contextImages)
    ? payload.contextImages
        .filter(
          (img): img is { name: string; mimeType: string; dataUrl: string } =>
            typeof img?.name === "string" &&
            typeof img?.mimeType === "string" &&
            typeof img?.dataUrl === "string" &&
            img.dataUrl.startsWith("data:image/"),
        )
        .slice(0, 4)
    : undefined;

  if (!prompt.trim() && !preset && !contextPrompt?.trim() && !contextImages?.length) {
    return Response.json({ error: "Prompt, preset, or context is required." }, { status: 400 });
  }

  if (payload.model && !isValidAIModelId(payload.model)) {
    return Response.json({ error: "Unknown model id." }, { status: 400 });
  }

  const styleIds = ["minimal", "bold", "fintech", "dark", "playful"] as const;
  const style: AIStyleId =
    typeof payload.style === "string" && styleIds.includes(payload.style as AIStyleId)
      ? (payload.style as AIStyleId)
      : "fintech";

  try {
    const out = await runAIGenerate({
      prompt,
      preset,
      style,
      model,
      contextPrompt,
      contextAttachmentCount,
      contextImages,
    });

    if (!out.ok || !out.result) {
      return Response.json(
        {
          ok: false,
          model: out.model,
          detectedIntent: out.detectedIntent,
          error: out.error ?? "Generation failed — the model did not return a valid layout.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      model: out.model,
      source: out.source,
      detectedIntent: out.detectedIntent,
      warning: out.warning,
      result: {
        ...out.result,
        preview: {
          ...out.result.preview,
          generationSource: out.source,
          detectedIntent: out.detectedIntent,
          warning: out.warning,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed.";
    console.error("[api/v1/ai/generate]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
