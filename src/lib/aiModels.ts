import {
  getOpenAIModelById,
  isValidOpenAIModelId,
  OPENAI_MODEL_OPTIONS,
  openAIModelsByCategory,
  type OpenAIModelOption,
} from "@/lib/openaiModels";

export type AIProvider = "ollama" | "openai";

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

/** Default for new sessions — local open-source via Ollama. */
export const DEFAULT_AI_MODEL_ID = "ollama:llama3.2";

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

function openAIToAIModel(m: OpenAIModelOption): AIModelOption {
  return {
    id: m.id,
    label: m.label,
    description: m.description,
    provider: "openai",
    recommended: m.recommended,
    deprecated: m.deprecated,
  };
}

const OPENAI_AS_AI: AIModelOption[] = OPENAI_MODEL_OPTIONS.map(openAIToAIModel);

export const AI_MODEL_OPTIONS: AIModelOption[] = [...OLLAMA_MODEL_OPTIONS, ...OPENAI_AS_AI];

const MODEL_BY_ID = new Map(AI_MODEL_OPTIONS.map((m) => [m.id, m]));

export function getAIModelById(id: string | undefined): AIModelOption | undefined {
  if (!id) return undefined;
  const hit = MODEL_BY_ID.get(id);
  if (hit) return hit;
  const legacy = getOpenAIModelById(id);
  return legacy ? openAIToAIModel(legacy) : undefined;
}

export function isValidAIModelId(id: string): boolean {
  return MODEL_BY_ID.has(id) || isValidOpenAIModelId(id);
}

export function normalizeAIModelId(id: string | undefined): string {
  if (id && isValidAIModelId(id)) return id;
  return DEFAULT_AI_MODEL_ID;
}

export function isOllamaModelId(id: string): boolean {
  return id.startsWith("ollama:");
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

/** Optgroups for the model `<select>` — local/open-source first, then OpenAI. */
export function aiModelSelectGroups(): AIModelSelectGroup[] {
  const groups: AIModelSelectGroup[] = [
    {
      key: "ollama",
      label: "Local & open source (Ollama)",
      models: OLLAMA_MODEL_OPTIONS,
    },
  ];
  for (const g of openAIModelsByCategory()) {
    groups.push({
      key: `openai-${g.category}`,
      label: `OpenAI GPT (cloud) — ${g.label}`,
      models: g.models.map(openAIToAIModel),
    });
  }
  return groups;
}

export function ollamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
}
