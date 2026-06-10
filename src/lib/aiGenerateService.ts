import {
  buildAIDesignSystemPrompt,
  buildAIDesignUserPrompt,
  tryBuildDesignFromLLMText,
} from "@/lib/aiDesignSpec";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import type { AIStyleId, AIGenerateResult } from "@/lib/aiMockGenerator";
import {
  detectScreenIntent,
  screenIntentLabel,
  type ScreenIntent,
} from "@/lib/aiScreenIntent";
import { isOllamaModelId, normalizeAIModelId } from "@/lib/aiModels";
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
  source?: "llm";
  detectedIntent: string;
  result?: AIGenerateResult;
  error?: string;
  warning?: string;
};

function withIntentPreview(
  result: AIGenerateResult,
  intent: ScreenIntent,
): AIGenerateResult {
  const label = screenIntentLabel(intent);
  return {
    ...result,
    preview: {
      ...result.preview,
      detectedIntent: label,
      flowLabel: result.preview.flowLabel.startsWith(label)
        ? result.preview.flowLabel
        : `${label} · ${result.preview.flowLabel}`,
    },
  };
}

function applyDesignTokensToResult(result: AIGenerateResult, tokens: ExtractedDesignTokens): AIGenerateResult {
  const nodes = { ...result.slice.nodes };
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type === "text" && tokens.fontFamily && !node.fontFamily) {
      nodes[id] = { ...node, fontFamily: tokens.fontFamily };
    }
  }
  return { ...result, slice: { ...result.slice, nodes } };
}

type LLMCallResult = { raw: string | null; apiError?: string };

async function callLLM(
  request: AIGenerateRequest,
  model: string,
  tokens: ExtractedDesignTokens,
  intent: ScreenIntent,
  userPromptOverride?: string,
): Promise<LLMCallResult> {
  const hasImages = (request.contextImages?.length ?? 0) > 0;
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

  if (isOllamaModelId(model)) {
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
    return "Ollama returned invalid layout JSON. Try an OpenAI model (GPT-4o Mini) for strict prompt matching.";
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
Build EXACTLY this screen — no templates, no generic home screen: ${request.prompt.trim() || request.preset || "see attached context"}`;
}

export async function runAIGenerate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
  const model = normalizeAIModelId(request.model);
  const tokens = extractDesignTokens(request.contextPrompt, request.prompt, request.style);
  const intent = detectScreenIntent(request.prompt, request.preset, request.contextPrompt);
  const intentLabel = screenIntentLabel(intent);

  const buildOptions = {
    prompt: request.prompt,
    preset: request.preset,
    style: request.style,
    modelId: model,
    contextAttachmentCount: request.contextAttachmentCount,
    tokens,
    intent,
  };

  let llmCall = await callLLM(request, model, tokens, intent);
  let fromLLM = tryBuildDesignFromLLMText(llmCall.raw, buildOptions);

  if (!fromLLM && !llmCall.apiError && llmCall.raw?.trim()) {
    llmCall = await callLLM(request, model, tokens, intent, buildRepairUserPrompt(request, intent));
    fromLLM = tryBuildDesignFromLLMText(llmCall.raw, buildOptions);
  }

  if (fromLLM) {
    return {
      ok: true,
      model,
      source: "llm",
      detectedIntent: intentLabel,
      result: applyDesignTokensToResult(
        withIntentPreview(
          { ...fromLLM, preview: { ...fromLLM.preview, generationSource: "llm" } },
          intent,
        ),
        tokens,
      ),
    };
  }

  return {
    ok: false,
    model,
    detectedIntent: intentLabel,
    error: buildParseFailureMessage(model, llmCall.raw, llmCall.apiError),
  };
}
