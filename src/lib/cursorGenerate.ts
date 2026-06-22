import type { AIContextImagePayload } from "@/lib/aiContextImages";
import type { ExtractedDesignTokens } from "@/lib/aiDesignTokens";
import {
  buildAIDesignSystemPrompt,
  buildAIDesignUserPrompt,
} from "@/lib/aiDesignSpec";
import type { AIStyleId } from "@/lib/aiMockGenerator";
import type { ScreenIntent } from "@/lib/aiScreenIntent";
import { cursorAgentModelId } from "@/lib/aiModels";
import { applyCursorTlsWorkaround, formatCursorTlsError } from "@/lib/cursorTls";

export type CursorGenerateInput = {
  modelId: string;
  prompt: string;
  preset?: string;
  style: AIStyleId;
  contextPrompt?: string;
  designTokens?: ExtractedDesignTokens;
  intent?: ScreenIntent;
  contextImages?: AIContextImagePayload[];
  userPromptOverride?: string;
  /** Browser-provided key; falls back to CURSOR_API_KEY env. */
  apiKey?: string;
};

export type CursorGenerateResult = {
  content: string | null;
  error?: string;
};

function buildCursorAgentPrompt(system: string, user: string): string {
  return `${system}

IMPORTANT: Do not use tools or write files. Reply with ONLY a single JSON object matching the schema above — no markdown fences, no commentary.

---

${user}`;
}

function formatCursorError(message: string, cause?: unknown): string {
  const tls = formatCursorTlsError(cause ?? new Error(message));
  if (tls) return tls;
  if (/401|unauthorized|authentication|invalid.*api.*key/i.test(message)) {
    return "Invalid CURSOR_API_KEY. Check the key in .env.local and restart `npm run dev`.";
  }
  if (/rate.?limit/i.test(message)) {
    return "Cursor rate limit reached. Wait a moment and try again.";
  }
  if (/not available or invalid/i.test(message)) {
    return "That Cursor model is not available on your account. Pick Composer 2.5 or Auto.";
  }
  return message.startsWith("Cursor") ? message : `Cursor API error: ${message}`;
}

function toCursorSdkImages(images: AIContextImagePayload[]) {
  return images.map((img) => {
    const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
    return { mimeType: img.mimeType || "image/png", data: img.dataUrl };
  });
}

/** Call a Cursor cloud agent for structured UI JSON. */
export async function generateWithCursor(input: CursorGenerateInput): Promise<CursorGenerateResult> {
  const apiKey = input.apiKey?.trim() || process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    return {
      content: null,
      error: "Add your Cursor key in the model menu, or set CURSOR_API_KEY in .env.local.",
    };
  }

  const images = (input.contextImages ?? []).slice(0, 1);
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

  const system = buildAIDesignSystemPrompt(
    input.style,
    input.preset,
    input.designTokens,
    input.intent,
  );
  const agentPrompt = buildCursorAgentPrompt(system, userText);
  const model = { id: cursorAgentModelId(input.modelId) };

  applyCursorTlsWorkaround();

  try {
    const { Agent } = await import("@cursor/sdk");

    const agentOptions = {
      apiKey,
      model,
      cloud: {},
      name: "Craft AI Generate",
    } as const;

    if (hasImages) {
      const agent = await Agent.create(agentOptions);
      try {
        const run = await agent.send(
          {
            text: agentPrompt,
            images: toCursorSdkImages(images),
          },
          { model },
        );
        const result = await run.wait();
        if (result.status === "error") {
          return { content: null, error: "Cursor agent run failed. Try again or pick a different model." };
        }
        const content = result.result?.trim();
        return content
          ? { content }
          : { content: null, error: "Cursor returned an empty response. Try again or refine your prompt." };
      } finally {
        agent.close();
      }
    }

    const result = await Agent.prompt(agentPrompt, agentOptions);
    if (result.status === "error") {
      return { content: null, error: "Cursor agent run failed. Try again or pick a different model." };
    }

    const content = result.result?.trim();
    if (content) return { content };

    return {
      content: null,
      error: "Cursor returned an empty response. Try again or refine your prompt.",
    };
  } catch (err) {
    const { CursorAgentError } = await import("@cursor/sdk");
    if (err instanceof CursorAgentError) {
      return { content: null, error: formatCursorError(err.message, err) };
    }
    const message = err instanceof Error ? err.message : "Request failed";
    if (/timeout|aborted/i.test(message)) {
      return { content: null, error: "Cursor request timed out. Try a shorter prompt or retry." };
    }
    return { content: null, error: formatCursorError(message, err) };
  }
}
