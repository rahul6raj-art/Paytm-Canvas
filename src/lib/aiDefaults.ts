import { isCursorConfigured } from "@/lib/cursorModels";
import { isOpenAIConfigured } from "@/lib/openaiGenerate";

/** Prefer direct OpenAI chat (seconds) over Cursor cloud agents (minutes). */
export function resolveDefaultAIModelId(): string {
  if (isOpenAIConfigured()) return "openai:gpt-4o-mini";
  if (isCursorConfigured()) return "cursor:composer-2.5";
  return "cursor:composer-2.5";
}
