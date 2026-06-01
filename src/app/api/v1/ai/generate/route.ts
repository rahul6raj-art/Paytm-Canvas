import { generateDesignFromPrompt } from "@/lib/aiMockGenerator";
import { isValidOpenAIModelId, normalizeOpenAIModelId } from "@/lib/openaiModels";

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
  };

  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  const preset = typeof payload.preset === "string" ? payload.preset : undefined;
  const model = normalizeOpenAIModelId(payload.model);

  if (!prompt.trim() && !preset) {
    return Response.json({ error: "Prompt or preset is required." }, { status: 400 });
  }

  if (payload.model && !isValidOpenAIModelId(payload.model)) {
    return Response.json({ error: "Unknown model id." }, { status: 400 });
  }

  const styleIds = ["minimal", "bold", "fintech", "dark", "playful"] as const;
  const style =
    typeof payload.style === "string" && styleIds.includes(payload.style as (typeof styleIds)[number])
      ? (payload.style as (typeof styleIds)[number])
      : "fintech";

  // When OPENAI_API_KEY is configured, call the Responses API here with `model`.
  // Until then, return the deterministic mock so the UI can exercise model selection.
  const result = generateDesignFromPrompt(prompt, { preset, style, model });

  return Response.json({ ok: true, model, result });
}
