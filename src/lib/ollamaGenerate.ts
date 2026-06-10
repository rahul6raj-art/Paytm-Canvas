import { ollamaBaseUrl, ollamaTagFromModelId } from "@/lib/aiModels";

export type OllamaGenerateInput = {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
};

/** Call a local Ollama chat endpoint for structured UI JSON (null if unavailable). */
export async function generateWithOllama(input: OllamaGenerateInput): Promise<string | null> {
  const tag = ollamaTagFromModelId(input.modelId);
  if (!tag || !input.userPrompt.trim()) return null;

  const base = ollamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: tag,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
