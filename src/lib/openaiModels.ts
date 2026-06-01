/** OpenAI chat / reasoning models available for AI design generation. */

export type OpenAIModelCategory =
  | "flagship"
  | "balanced"
  | "fast"
  | "reasoning"
  | "codex"
  | "legacy";

export interface OpenAIModelOption {
  id: string;
  label: string;
  description: string;
  category: OpenAIModelCategory;
  /** Shown in UI as recommended default for UI/design prompts. */
  recommended?: boolean;
  /** Still selectable but marked as retiring or superseded. */
  deprecated?: boolean;
}

export const OPENAI_MODEL_CATEGORY_LABELS: Record<OpenAIModelCategory, string> = {
  flagship: "Flagship",
  balanced: "Balanced",
  fast: "Fast & economical",
  reasoning: "Reasoning (o-series)",
  codex: "Coding & agents",
  legacy: "Legacy",
};

export const OPENAI_MODEL_OPTIONS: OpenAIModelOption[] = [
  {
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Best overall quality for complex screens, flows, and copy.",
    category: "flagship",
    recommended: true,
  },
  {
    id: "gpt-5.5-pro",
    label: "GPT-5.5 Pro",
    description: "Maximum capability; slower and higher cost.",
    category: "flagship",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Strong production default with large context.",
    category: "flagship",
    recommended: true,
  },
  {
    id: "gpt-5.4-pro",
    label: "GPT-5.4 Pro",
    description: "Higher reasoning depth for intricate layouts.",
    category: "flagship",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "Fast iterations with solid layout quality.",
    category: "balanced",
    recommended: true,
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 Mini",
    description: "Good quality at lower latency and cost.",
    category: "balanced",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    description: "Quick drafts and simple screen variants.",
    category: "fast",
  },
  {
    id: "gpt-5-nano",
    label: "GPT-5 Nano",
    description: "High-throughput simple UI blocks and labels.",
    category: "fast",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    description: "Mature general model without extended reasoning.",
    category: "balanced",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    description: "Lightweight general tasks.",
    category: "fast",
  },
  {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 Nano",
    description: "Cheapest text generation for quick probes.",
    category: "fast",
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    description: "Efficient multi-step reasoning for structured UI specs.",
    category: "reasoning",
    recommended: true,
  },
  {
    id: "o4-mini-high",
    label: "o4-mini High",
    description: "More reasoning budget; better for dense dashboards.",
    category: "reasoning",
  },
  {
    id: "o3",
    label: "o3",
    description: "Deep reasoning; retiring from API Aug 2026.",
    category: "reasoning",
    deprecated: true,
  },
  {
    id: "o3-mini",
    label: "o3-mini",
    description: "Lightweight reasoning tasks.",
    category: "reasoning",
  },
  {
    id: "o3-pro",
    label: "o3-pro",
    description: "Maximum o-series reasoning.",
    category: "reasoning",
    deprecated: true,
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    description: "Best for component-heavy screens and design systems.",
    category: "codex",
    recommended: true,
  },
  {
    id: "gpt-5.1-codex-mini",
    label: "GPT-5.1 Codex Mini",
    description: "Faster coding-oriented generation.",
    category: "codex",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "Previous-generation multimodal model.",
    category: "legacy",
    deprecated: true,
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    description: "Previous-generation fast model.",
    category: "legacy",
    deprecated: true,
  },
];

export const DEFAULT_OPENAI_MODEL_ID = "gpt-5.4";

const MODEL_BY_ID = new Map(OPENAI_MODEL_OPTIONS.map((m) => [m.id, m]));

const STORAGE_KEY = "paytm-craft-ai-model";

export function getOpenAIModelById(id: string | undefined): OpenAIModelOption | undefined {
  if (!id) return undefined;
  return MODEL_BY_ID.get(id);
}

export function isValidOpenAIModelId(id: string): boolean {
  return MODEL_BY_ID.has(id);
}

export function normalizeOpenAIModelId(id: string | undefined): string {
  if (id && isValidOpenAIModelId(id)) return id;
  return DEFAULT_OPENAI_MODEL_ID;
}

export function getStoredOpenAIModelId(): string {
  if (typeof window === "undefined") return DEFAULT_OPENAI_MODEL_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeOpenAIModelId(raw ?? undefined);
  } catch {
    return DEFAULT_OPENAI_MODEL_ID;
  }
}

export function setStoredOpenAIModelId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalizeOpenAIModelId(id));
  } catch {
    /* ignore quota / private mode */
  }
}

export function openAIModelsByCategory(): { category: OpenAIModelCategory; label: string; models: OpenAIModelOption[] }[] {
  const order: OpenAIModelCategory[] = [
    "flagship",
    "balanced",
    "fast",
    "reasoning",
    "codex",
    "legacy",
  ];
  return order.map((category) => ({
    category,
    label: OPENAI_MODEL_CATEGORY_LABELS[category],
    models: OPENAI_MODEL_OPTIONS.filter((m) => m.category === category),
  }));
}
