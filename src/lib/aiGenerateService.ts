import {
  buildAIDesignSystemPrompt,
  buildAIDesignUserPrompt,
  tryBuildDesignFromLLMText,
} from "@/lib/aiDesignSpec";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import { tryRichGenerate } from "@/lib/aiGenerateFastPath";
import { isSparseLLMLayout } from "@/lib/aiGenerateQuality";
import type { AIStyleId, AIGenerateResult } from "@/lib/aiMockGenerator";
import { supportsRichScreen } from "@/lib/aiRichMobileBuilder";
import {
  detectScreenIntent,
  screenIntentLabel,
  type ScreenIntent,
} from "@/lib/aiScreenIntent";
import { isOllamaModelId, isCursorModelId, isOpenAIModelId, normalizeAIModelId } from "@/lib/aiModels";
import { generateWithCursor } from "@/lib/cursorGenerate";
import { isCursorConfigured } from "@/lib/cursorModels";
import { generateWithOllama } from "@/lib/ollamaGenerate";
import { generateWithOpenAI, isOpenAIConfigured } from "@/lib/openaiGenerate";
import type { AIContextImagePayload } from "@/lib/aiContextImages";
import type { ExtractedDesignTokens } from "@/lib/aiDesignTokens";

export type AIGenerateRequest = {
  prompt: string;
  preset?: string;
  style: AIStyleId;
  model?: string;
  contextPrompt?: string;
  contextAttachmentCount?: number;
  contextImages?: AIContextImagePayload[];
};

export type AIGenerateResponse = {
  ok: boolean;
  model: string;
  source?: "llm" | "rich";
  detectedIntent: string;
  result?: AIGenerateResult;
  error?: string;
  warning?: string;
};

type LLMCallResult = { raw: string | null; apiError?: string };

type BuildDesignFromLLMOptions = Parameters<typeof tryBuildDesignFromLLMText>[1];

async function callLLM(
  request: AIGenerateRequest,
  model: string,
  tokens: ExtractedDesignTokens,
  intent: ScreenIntent,
  userPromptOverride?: string,
): Promise<LLMCallResult> {
  const hasImages = (request.contextImages?.length ?? 0) > 0;

  if (isOllamaModelId(model)) {
    const system = buildAIDesignSystemPrompt(request.style, request.preset, tokens, intent);
    const user =
      userPromptOverride ??
      buildAIDesignUserPrompt(
        request.prompt,
        request.contextPrompt,
        request.preset,
        intent,
        hasImages,
      );
    const imageNote = hasImages
      ? "\n\nReference images were attached but Ollama cannot see them — follow the text description and AUTHORITATIVE USER REQUEST exactly."
      : "";
    const raw = await generateWithOllama({
      modelId: model,
      systemPrompt: `${system}${imageNote}`,
      userPrompt: user,
    });
    return { raw };
  }

  if (isOpenAIModelId(model)) {
    const out = await generateWithOpenAI({
      modelId: model,
      prompt: request.prompt,
      preset: request.preset,
      style: request.style,
      contextPrompt: request.contextPrompt,
      designTokens: tokens,
      intent,
      contextImages: request.contextImages,
      userPromptOverride: userPromptOverride,
    });
    return { raw: out.content, apiError: out.error };
  }

  if (isCursorModelId(model)) {
    const out = await generateWithCursor({
      modelId: model,
      prompt: request.prompt,
      preset: request.preset,
      style: request.style,
      contextPrompt: request.contextPrompt,
      designTokens: tokens,
      intent,
      contextImages: request.contextImages,
      userPromptOverride: userPromptOverride,
    });
    return { raw: out.content, apiError: out.error };
  }

  const out = await generateWithOpenAI({
    modelId: model,
    prompt: request.prompt,
    preset: request.preset,
    style: request.style,
    contextPrompt: request.contextPrompt,
    designTokens: tokens,
    intent,
    contextImages: request.contextImages,
    userPromptOverride: userPromptOverride,
  });
  return { raw: out.content, apiError: out.error };
}

function buildParseFailureMessage(model: string, llmRaw: string | null, apiError?: string): string {
  if (apiError) return apiError;
  if (isOllamaModelId(model)) {
    if (!llmRaw?.trim()) {
      return "Ollama returned no response. Ensure Ollama is running and the model is installed (`ollama pull …`).";
    }
    return "Ollama returned invalid layout JSON. Try GPT-4o Mini for structured layouts.";
  }
  if (isCursorModelId(model)) {
    if (!isCursorConfigured()) {
      return "CURSOR_API_KEY is not set. Add it to .env.local for Cursor model generation.";
    }
    if (!llmRaw?.trim()) {
      return "Cursor returned no response. Check your API key and try again.";
    }
    return "Cursor returned invalid layout JSON. Attach Design.md and use a specific screen prompt, or try GPT-4o Mini.";
  }
  if (isOpenAIModelId(model)) {
    if (!isOpenAIConfigured()) {
      return "OPENAI_API_KEY is not set. Add it to .env.local for fast generation.";
    }
    if (!llmRaw?.trim()) {
      return "The model returned an empty response. Try again or switch models.";
    }
    return "The model response could not be parsed as layout JSON. Refine your prompt or retry.";
  }
  if (!isOpenAIConfigured()) {
    return "OPENAI_API_KEY is not set. Add it to .env.local for prompt-faithful generation.";
  }
  if (!llmRaw?.trim()) {
    return "The model returned an empty response. Try again or switch models.";
  }
  return "The model response could not be parsed as layout JSON. Refine your prompt or try GPT-4o Mini.";
}

function buildRepairUserPrompt(request: AIGenerateRequest, intent: ScreenIntent): string {
  const base = buildAIDesignUserPrompt(
    request.prompt,
    request.contextPrompt,
    request.preset,
    intent,
    (request.contextImages?.length ?? 0) > 0,
  );
  return `${base}

RETRY: Your previous reply was missing or invalid JSON. Return ONLY a single JSON object matching the schema.
Build EXACTLY this screen with at least 20 distinct elements — no generic templates: ${request.prompt.trim() || request.preset || "see attached context"}`;
}

function successRichResponse(rich: AIGenerateResponse, warning?: string): AIGenerateResponse {
  if (!rich.ok || !rich.result) return rich;
  return {
    ...rich,
    warning,
    result: {
      ...rich.result,
      preview: {
        ...rich.result.preview,
        warning,
      },
    },
  };
}

async function runLLMPath(
  request: AIGenerateRequest,
  model: string,
  tokens: ExtractedDesignTokens,
  intent: ScreenIntent,
  intentLabel: string,
  buildOptions: BuildDesignFromLLMOptions,
): Promise<AIGenerateResponse> {
  let llmCall = await callLLM(request, model, tokens, intent);
  let fromLLM = tryBuildDesignFromLLMText(llmCall.raw, buildOptions);

  // Skip a second LLM round-trip when rich builder can salvage mobile/product layouts.
  if (
    !fromLLM &&
    !llmCall.apiError &&
    llmCall.raw?.trim() &&
    !isCursorModelId(model) &&
    !supportsRichScreen(intent)
  ) {
    llmCall = await callLLM(request, model, tokens, intent, buildRepairUserPrompt(request, intent));
    fromLLM = tryBuildDesignFromLLMText(llmCall.raw, buildOptions);
  }

  if (!fromLLM) {
    return {
      ok: false,
      model,
      detectedIntent: intentLabel,
      error: buildParseFailureMessage(model, llmCall.raw, llmCall.apiError),
    };
  }

  return {
    ok: true,
    model,
    source: "llm",
    detectedIntent: intentLabel,
    result: {
      ...fromLLM,
      preview: { ...fromLLM.preview, generationSource: "llm", detectedIntent: intentLabel },
    },
  };
}

export async function runAIGenerate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
  const model = normalizeAIModelId(request.model);
  const intent = detectScreenIntent(request.prompt, request.preset, request.contextPrompt);
  const intentLabel = screenIntentLabel(intent);
  const hasImages = (request.contextImages?.length ?? 0) > 0;

  const buildOptions: BuildDesignFromLLMOptions = {
    prompt: request.prompt,
    preset: request.preset,
    style: request.style,
    modelId: model,
    contextAttachmentCount: request.contextAttachmentCount,
    tokens: extractDesignTokens(request.contextPrompt, request.prompt, request.style),
    intent,
  };

  // Local rich builder when prompt intent is supported (activity tracking works even with images).
  const richOut = tryRichGenerate({ ...request, model });
  if (richOut?.ok) return richOut;

  const llmOut = await runLLMPath(
    request,
    model,
    buildOptions.tokens!,
    intent,
    intentLabel,
    buildOptions,
  );

  if (llmOut.ok && llmOut.result && supportsRichScreen(intent)) {
    if (isSparseLLMLayout(llmOut.result, intent)) {
      const richOut = tryRichGenerate({ ...request, model });
      if (richOut?.ok) {
        return successRichResponse(
          richOut,
          "Upgraded to high-fidelity design layout (model output was too sparse).",
        );
      }
    }
    return llmOut;
  }

  if (!llmOut.ok && supportsRichScreen(intent)) {
    const richOut = tryRichGenerate({ ...request, model });
    if (richOut?.ok) {
      return successRichResponse(
        richOut,
        "Using high-fidelity design layout (model output was not usable).",
      );
    }
  }

  return llmOut;
}
