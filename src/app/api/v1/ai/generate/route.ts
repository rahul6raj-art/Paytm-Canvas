import { generateDesignFromPrompt } from "@/lib/aiMockGenerator";
import { isOllamaModelId, isValidAIModelId, normalizeAIModelId } from "@/lib/aiModels";
import { generateWithOllama } from "@/lib/ollamaGenerate";

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
  };

  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  const preset = typeof payload.preset === "string" ? payload.preset : undefined;
  const model = normalizeAIModelId(payload.model);
  const contextPrompt =
    typeof payload.contextPrompt === "string" ? payload.contextPrompt : undefined;
  const contextAttachmentCount =
    typeof payload.contextAttachmentCount === "number" ? payload.contextAttachmentCount : undefined;

  if (!prompt.trim() && !preset && !contextPrompt?.trim()) {
    return Response.json({ error: "Prompt, preset, or context is required." }, { status: 400 });
  }

  if (payload.model && !isValidAIModelId(payload.model)) {
    return Response.json({ error: "Unknown model id." }, { status: 400 });
  }

  const styleIds = ["minimal", "bold", "fintech", "dark", "playful"] as const;
  const style =
    typeof payload.style === "string" && styleIds.includes(payload.style as (typeof styleIds)[number])
      ? (payload.style as (typeof styleIds)[number])
      : "fintech";

  // Ollama: call local runtime when selected (falls back to mock layout if unreachable).
  if (isOllamaModelId(model)) {
    await generateWithOllama({
      modelId: model,
      prompt,
      contextPrompt,
    });
  }

  // When OPENAI_API_KEY is configured, call the Responses API here with `model`.
  // Until then, return the deterministic mock so the UI can exercise model selection.
  const result = generateDesignFromPrompt(prompt, {
    preset,
    style,
    model,
    contextPrompt,
    contextAttachmentCount,
  });

  return Response.json({ ok: true, model, result });
}
