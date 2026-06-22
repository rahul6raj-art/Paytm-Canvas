export type AIKeyProviderId = "openai" | "cursor" | "anthropic";

export type StoredAIKey = {
  id: string;
  provider: AIKeyProviderId;
  /** User-visible label, e.g. "Work key". */
  label: string;
  key: string;
  createdAt: string;
};

export type AIKeysStore = {
  keys: StoredAIKey[];
  /** Active key id per provider. */
  activeByProvider: Partial<Record<AIKeyProviderId, string>>;
};

export type AIKeyProviderDef = {
  id: AIKeyProviderId;
  label: string;
  description: string;
  placeholder: string;
  getKeyUrl: string;
  envVar: string;
};

export type ResolvedAIApiKeys = Partial<Record<AIKeyProviderId, string>>;
