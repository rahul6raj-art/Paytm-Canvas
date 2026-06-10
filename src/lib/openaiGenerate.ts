import type { AIContextImagePayload } from "@/lib/aiContextImages";
import type { ExtractedDesignTokens } from "@/lib/aiDesignTokens";
import {
  buildAIDesignSystemPrompt,
  buildAIDesignUserPrompt,
} from "@/lib/aiDesignSpec";
import type { AIStyleId } from "@/lib/aiMockGenerator";
import type { ScreenIntent } from "@/lib/aiScreenIntent";

export type OpenAIGenerateInput = {
  modelId: string;
  prompt: string;
  preset?: string;
  style: AIStyleId;
  contextPrompt?: string;
  designTokens?: ExtractedDesignTokens;
  intent?: ScreenIntent;
  contextImages?: AIContextImagePayload[];
  /** When set, used instead of buildAIDesignUserPrompt (e.g. JSON repair retry). */
  userPromptOverride?: string;
};

export type OpenAIGenerateResult = {
  content: string | null;
  error?: string;
};

const VISION_MODEL_ID = "gpt-4o-mini";

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function resolveModelId(modelId: string, hasImages: boolean): string {
  if (!hasImages) return modelId;
  if (/^gpt-4o/i.test(modelId)) return modelId;
  return VISION_MODEL_ID;
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

function formatOpenAIApiError(status: number, body: { error?: { message?: string; code?: string; type?: string } }): string {
  const code = body.error?.code;
  const message = body.error?.message?.trim();

  if (code === "insufficient_quota") {
    return "OpenAI quota exceeded. Add billing at https://platform.openai.com/settings/organization/billing or switch to a local Ollama model.";
  }
  if (code === "invalid_api_key" || status === 401) {
    return "Invalid OPENAI_API_KEY. Check the key in .env.local and restart the dev server.";
  }
  if (code === "model_not_found") {
    return `OpenAI model not found (${message ?? "unknown"}). Pick a different model in the dropdown.`;
  }
  if (message) {
    return `OpenAI API error: ${message}`;
  }
  return `OpenAI API error (HTTP ${status}).`;
}

/** Call OpenAI chat completions for structured UI JSON. */
export async function generateWithOpenAI(input: OpenAIGenerateInput): Promise<OpenAIGenerateResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { content: null, error: "OPENAI_API_KEY is not set. Add it to .env.local and restart `npm run dev`." };
  }

  const images = input.contextImages ?? [];
  const hasImages = images.length > 0;
  const userText =
    input.userPromptOverride ??
    buildAIDesignUserPrompt(
      input.prompt,
      input.contextPrompt,
      input.preset,
      input.intent,
      hasImages,
    );
  if (!userText.trim() && !hasImages) {
    return { content: null, error: "Prompt and context are empty — add a description before generating." };
  }

  const userContent: string | ChatContentPart[] = hasImages
    ? [
        { type: "text", text: userText || "Replicate the attached reference screen on the canvas." },
        ...images.map(
          (img): ChatContentPart => ({
            type: "image_url",
            image_url: { url: img.dataUrl, detail: "high" },
          }),
        ),
      ]
    : userText;

  const model = resolveModelId(input.modelId, hasImages);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildAIDesignSystemPrompt(input.style, input.preset, input.designTokens, input.intent),
          },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });

    const data = (await res.json()) as {
      error?: { message?: string; code?: string; type?: string };
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    };

    if (!res.ok) {
      return { content: null, error: formatOpenAIApiError(res.status, data) };
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return { content };
    }

    const finish = data.choices?.[0]?.finish_reason;
    if (finish === "length") {
      return {
        content: null,
        error: "OpenAI response was truncated (too long). Shorten attachments or simplify the prompt.",
      };
    }

    return {
      content: null,
      error: "OpenAI returned an empty response. Try again or pick a different model.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    if (/timeout|aborted/i.test(message)) {
      return { content: null, error: "OpenAI request timed out. Try a shorter prompt or retry." };
    }
    return { content: null, error: `Could not reach OpenAI: ${message}` };
  }
}
