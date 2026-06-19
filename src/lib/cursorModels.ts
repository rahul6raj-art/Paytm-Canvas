import {
  CURSOR_MODEL_OPTIONS,
  type AIModelOption,
} from "@/lib/aiModels";
import { applyCursorTlsWorkaround } from "@/lib/cursorTls";

export function isCursorConfigured(): boolean {
  return Boolean(process.env.CURSOR_API_KEY?.trim());
}

/** Fetch live Cursor models for the authenticated API key. Falls back to static list. */
export async function fetchCursorModelOptions(): Promise<AIModelOption[]> {
  if (!isCursorConfigured()) return CURSOR_MODEL_OPTIONS;

  applyCursorTlsWorkaround();

  try {
    const { Cursor } = await import("@cursor/sdk");
    const models = await Cursor.models.list({ apiKey: process.env.CURSOR_API_KEY!.trim() });
    if (!models.length) return CURSOR_MODEL_OPTIONS;

    return models.map((m) => ({
      id: `cursor:${m.id}`,
      label: m.displayName,
      description: m.description ?? "Cursor model via Cursor SDK",
      provider: "cursor" as const,
      recommended: m.id === "composer-2.5" || m.variants?.some((v) => v.isDefault),
    }));
  } catch {
    return CURSOR_MODEL_OPTIONS;
  }
}
