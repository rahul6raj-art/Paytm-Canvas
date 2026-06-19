export type AIProvider = "ollama" | "openai" | "cursor";

export type AIModelOption = {
  id: string;
  label: string;
  description: string;
  provider: AIProvider;
  recommended?: boolean;
  deprecated?: boolean;
  /** Ollama pull/run tag (without `ollama:` prefix). */
  ollamaTag?: string;
};

/** Default when no API keys — overridden by resolveDefaultAIModelId() when OpenAI is configured. */
export const DEFAULT_AI_MODEL_ID = "cursor:composer-2.5";

const STORAGE_KEY = "paytm-craft-ai-model";

export const OLLAMA_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: "ollama:llama3.2",
    label: "Llama 3.2",
    ollamaTag: "llama3.2",
    provider: "ollama",
    description: "Meta’s efficient local default — great for UI layouts and copy.",
    recommended: true,
  },
  {
    id: "ollama:llama3.1",
    label: "Llama 3.1",
    ollamaTag: "llama3.1",
    provider: "ollama",
    description: "Strong general-purpose open model for screens and flows.",
  },
  {
    id: "ollama:llama3.1:70b",
    label: "Llama 3.1 70B",
    ollamaTag: "llama3.1:70b",
    provider: "ollama",
    description: "Larger Llama — higher quality when you have GPU/RAM headroom.",
  },
  {
    id: "ollama:deepseek-r1",
    label: "DeepSeek R1",
    ollamaTag: "deepseek-r1",
    provider: "ollama",
    description: "Reasoning-focused DeepSeek — good for dense dashboards and specs.",
    recommended: true,
  },
  {
    id: "ollama:deepseek-r1:8b",
    label: "DeepSeek R1 8B",
    ollamaTag: "deepseek-r1:8b",
    provider: "ollama",
    description: "Smaller DeepSeek R1 — faster on consumer hardware.",
  },
  {
    id: "ollama:deepseek-v3",
    label: "DeepSeek V3",
    ollamaTag: "deepseek-v3",
    provider: "ollama",
    description: "DeepSeek flagship — strong coding and structured UI output.",
  },
  {
    id: "ollama:qwen2.5",
    label: "Qwen 2.5",
    ollamaTag: "qwen2.5",
    provider: "ollama",
    description: "Alibaba Qwen — multilingual UI and form-heavy screens.",
  },
  {
    id: "ollama:qwen2.5-coder",
    label: "Qwen 2.5 Coder",
    ollamaTag: "qwen2.5-coder",
    provider: "ollama",
    description: "Code-oriented Qwen — component libraries and design tokens.",
  },
  {
    id: "ollama:mistral",
    label: "Mistral",
    ollamaTag: "mistral",
    provider: "ollama",
    description: "Fast European open model for quick layout drafts.",
  },
  {
    id: "ollama:mixtral",
    label: "Mixtral 8x7B",
    ollamaTag: "mixtral",
    provider: "ollama",
    description: "Mixture-of-experts — balanced quality and speed locally.",
  },
  {
    id: "ollama:gemma2",
    label: "Gemma 2",
    ollamaTag: "gemma2",
    provider: "ollama",
    description: "Google Gemma — lightweight screens on modest hardware.",
  },
  {
    id: "ollama:phi3",
    label: "Phi-3",
    ollamaTag: "phi3",
    provider: "ollama",
    description: "Microsoft Phi-3 — compact model for simple wireframes.",
  },
  {
    id: "ollama:codellama",
    label: "Code Llama",
    ollamaTag: "codellama",
    provider: "ollama",
    description: "Meta coding model — design-system and component generation.",
  },
];

export const OPENAI_FAST_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: "openai:gpt-4o-mini",
    label: "GPT-4o Mini",
    description: "Fastest — direct chat API, great with text and reference images.",
    provider: "openai",
    recommended: true,
  },
  {
    id: "openai:gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    description: "Very fast drafts and simple screens.",
    provider: "openai",
  },
];

export const CURSOR_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: "cursor:composer-2.5",
    label: "Composer 2.5",
    description: "Cursor cloud agent — higher quality, slower (30–90s).",
    provider: "cursor",
    recommended: true,
  },
  {
    id: "cursor:default",
    label: "Auto",
    description: "Let Cursor pick the best model for your account.",
    provider: "cursor",
  },
];

export const AI_MODEL_OPTIONS: AIModelOption[] = [...OPENAI_FAST_MODEL_OPTIONS, ...CURSOR_MODEL_OPTIONS];

const MODEL_BY_ID = new Map(AI_MODEL_OPTIONS.map((m) => [m.id, m]));

export function getAIModelById(id: string | undefined): AIModelOption | undefined {
  if (!id) return undefined;
  return MODEL_BY_ID.get(id);
}

export function isValidAIModelId(id: string): boolean {
  return isOpenAIModelId(id) || isCursorModelId(id);
}

export function isOpenAIModelId(id: string): boolean {
  return id.startsWith("openai:");
}

export function openaiChatModelId(modelId: string): string {
  return isOpenAIModelId(modelId) ? modelId.slice("openai:".length) : modelId;
}

export function normalizeAIModelId(id: string | undefined): string {
  if (id && isValidAIModelId(id)) return id;
  return DEFAULT_AI_MODEL_ID;
}

export function isOllamaModelId(id: string): boolean {
  return id.startsWith("ollama:");
}

export function isCursorModelId(id: string): boolean {
  return id.startsWith("cursor:");
}

export function cursorAgentModelId(modelId: string): string {
  const id = isCursorModelId(modelId) ? modelId.slice("cursor:".length) : modelId;
  if (id === "auto") return "default";
  return id;
}

export function ollamaTagFromModelId(id: string): string | null {
  if (!isOllamaModelId(id)) return null;
  const meta = getAIModelById(id);
  if (meta?.ollamaTag) return meta.ollamaTag;
  return id.slice("ollama:".length) || null;
}

export function getStoredAIModelId(): string {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeAIModelId(raw ?? undefined);
  } catch {
    return DEFAULT_AI_MODEL_ID;
  }
}

export function setStoredAIModelId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalizeAIModelId(id));
  } catch {
    /* ignore quota / private mode */
  }
}

export type AIModelSelectGroup = {
  key: string;
  label: string;
  models: AIModelOption[];
};

/** Fast OpenAI chat first, then Cursor cloud agents. */
export function aiModelSelectGroups(cursorModels: AIModelOption[] = CURSOR_MODEL_OPTIONS): AIModelSelectGroup[] {
  return [
    {
      key: "openai-fast",
      label: "Fast (recommended)",
      models: OPENAI_FAST_MODEL_OPTIONS,
    },
    {
      key: "cursor",
      label: "Cursor (slower)",
      models: cursorModels.length ? cursorModels : CURSOR_MODEL_OPTIONS,
    },
  ];
}

export function ollamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
}
