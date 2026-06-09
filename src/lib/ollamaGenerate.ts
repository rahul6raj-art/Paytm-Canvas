import { ollamaBaseUrl, ollamaTagFromModelId } from "@/lib/aiModels";

export type OllamaGenerateInput = {
  modelId: string;
  prompt: string;
  contextPrompt?: string;
};

/** Call a local Ollama instance for design generation (returns null if unavailable). */
export async function generateWithOllama(input: OllamaGenerateInput): Promise<string | null> {
  const tag = ollamaTagFromModelId(input.modelId);
  if (!tag) return null;

  const userText = [input.prompt.trim(), input.contextPrompt?.trim()].filter(Boolean).join("\n\n");
  if (!userText) return null;

  const base = ollamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: tag,
        prompt: userText,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return typeof data.response === "string" ? data.response : null;
  } catch {
    return null;
  }
}
