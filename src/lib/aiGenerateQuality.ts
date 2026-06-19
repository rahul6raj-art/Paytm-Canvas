import type { AIGenerateResult } from "@/lib/aiMockGenerator";
import type { ScreenIntent } from "@/lib/aiScreenIntent";

export function countAIDesignNodes(result: AIGenerateResult): number {
  return Object.keys(result.slice.nodes).length;
}

const MIN_NODES: Partial<Record<ScreenIntent, number>> = {
  auth: 14,
  checkout: 24,
  mobile_home: 40,
  activity_tracking: 24,
  profile: 20,
  transactions: 20,
  send_money: 24,
  recharge: 24,
  generic_mobile: 18,
};

/** True when an LLM flat layout is too sparse to feel production-ready. */
export function isSparseLLMLayout(result: AIGenerateResult, intent: ScreenIntent): boolean {
  const count = countAIDesignNodes(result);
  const min = MIN_NODES[intent] ?? 16;
  return count < min;
}

export function shouldPreferRichBuilder(intent: ScreenIntent, hasReferenceImages: boolean): boolean {
  if (hasReferenceImages && intent !== "activity_tracking") return false;
  return intent !== "dashboard" && intent !== "landing";
}
