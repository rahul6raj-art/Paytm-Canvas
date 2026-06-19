import { extractDesignTokens, type ExtractedDesignTokens } from "@/lib/aiDesignTokens";
import { shouldPreferRichBuilder } from "@/lib/aiGenerateQuality";
import type { AIGenerateResult } from "@/lib/aiMockGenerator";
import {
  buildRichScreenForIntent,
  supportsRichScreen,
  type RichMobileBuildOptions,
} from "@/lib/aiRichMobileBuilder";
import {
  detectScreenIntent,
  extractScreenTitle,
  screenIntentLabel,
  type ScreenIntent,
} from "@/lib/aiScreenIntent";
import { normalizeAIModelId } from "@/lib/aiModels";
import type { AIGenerateRequest, AIGenerateResponse } from "@/lib/aiGenerateService";

export type RichGenerateInput = Pick<
  AIGenerateRequest,
  "prompt" | "preset" | "style" | "model" | "contextPrompt" | "contextAttachmentCount" | "contextImages"
>;

function withIntentPreview(result: AIGenerateResult, intent: ScreenIntent): AIGenerateResult {
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

function applyDesignTokensToResult(
  result: AIGenerateResult,
  tokens: ExtractedDesignTokens,
): AIGenerateResult {
  const nodes = { ...result.slice.nodes };
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    nodes[id] = {
      ...node,
      fontFamily: node.fontFamily ?? tokens.fontFamily,
      fontSize: node.fontSize ?? tokens.bodySize,
      lineHeight: node.lineHeight ?? tokens.bodyLine / tokens.bodySize,
    };
  }
  return { ...result, slice: { ...result.slice, nodes } };
}

function richOptionsFor(
  request: RichGenerateInput,
  model: string,
  tokens: ExtractedDesignTokens,
  intent: ScreenIntent,
): RichMobileBuildOptions {
  return {
    prompt: request.prompt,
    preset: request.preset,
    tokens,
    modelId: model,
    contextAttachmentCount: request.contextAttachmentCount,
    title: extractScreenTitle(request.prompt, intent),
  };
}

export function canUseRichFastPath(input: RichGenerateInput): boolean {
  const hasImages = (input.contextImages?.length ?? 0) > 0;
  const intent = detectScreenIntent(input.prompt, input.preset, input.contextPrompt);
  // Activity tracking uses a dedicated local builder — reference images are optional.
  if (hasImages && intent !== "activity_tracking") return false;
  return shouldPreferRichBuilder(intent, false) && supportsRichScreen(intent);
}

/** Instant high-fidelity layout — no network or LLM. Returns null when LLM/vision is required. */
export function tryRichGenerate(input: RichGenerateInput): AIGenerateResponse | null {
  const hasImages = (input.contextImages?.length ?? 0) > 0;
  const model = normalizeAIModelId(input.model);
  const tokens = extractDesignTokens(input.contextPrompt, input.prompt, input.style);
  const intent = detectScreenIntent(input.prompt, input.preset, input.contextPrompt);
  const intentLabel = screenIntentLabel(intent);

  if (hasImages && intent !== "activity_tracking") return null;

  if (!shouldPreferRichBuilder(intent, hasImages) || !supportsRichScreen(intent)) {
    return null;
  }

  const rich = buildRichScreenForIntent(intent, richOptionsFor(input, model, tokens, intent));
  if (!rich) return null;

  return {
    ok: true,
    model,
    source: "rich",
    detectedIntent: intentLabel,
    result: applyDesignTokensToResult(
      withIntentPreview(
        {
          ...rich,
          preview: {
            ...rich.preview,
            generationSource: "rich",
            detectedIntent: intentLabel,
          },
        },
        intent,
      ),
      tokens,
    ),
  };
}

export function richFastPathIntent(input: RichGenerateInput): ScreenIntent | null {
  if (!canUseRichFastPath(input)) return null;
  return detectScreenIntent(input.prompt, input.preset, input.contextPrompt);
}
