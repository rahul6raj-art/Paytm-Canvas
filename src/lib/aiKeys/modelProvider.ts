import { isCursorModelId, isOpenAIModelId } from "@/lib/aiModels";
import type { AIKeyProviderId } from "@/lib/aiKeys/types";

export function providerForModelId(modelId: string): AIKeyProviderId | null {
  if (isOpenAIModelId(modelId)) return "openai";
  if (isCursorModelId(modelId)) return "cursor";
  return null;
}
