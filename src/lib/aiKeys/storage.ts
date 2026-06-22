import type { AIKeyProviderId, AIKeysStore, ResolvedAIApiKeys, StoredAIKey } from "@/lib/aiKeys/types";

const STORAGE_KEY = "paytm-craft-ai-keys-v1";

function getStorage(): Storage | null {
  try {
    const w = globalThis as typeof globalThis & { window?: Window };
    return w.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function emptyStore(): AIKeysStore {
  return { keys: [], activeByProvider: {} };
}

export function readAIKeysStore(): AIKeysStore {
  const storage = getStorage();
  if (!storage) return emptyStore();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as AIKeysStore;
    if (!parsed || !Array.isArray(parsed.keys)) return emptyStore();
    return {
      keys: parsed.keys.filter((k) => k?.id && k?.provider && k?.key),
      activeByProvider: parsed.activeByProvider ?? {},
    };
  } catch {
    return emptyStore();
  }
}

export function writeAIKeysStore(store: AIKeysStore): void {
  const storage = getStorage();
  if (!storage) {
    throw new Error("Could not access browser storage. Keys cannot be saved on this device.");
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error("Could not save key — browser storage may be full or blocked.");
  }
}

export function newAIKeyId(): string {
  return `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function keysForProvider(provider: AIKeyProviderId): StoredAIKey[] {
  return readAIKeysStore().keys.filter((k) => k.provider === provider);
}

export function getActiveKeyForProvider(provider: AIKeyProviderId): StoredAIKey | null {
  const store = readAIKeysStore();
  const activeId = store.activeByProvider[provider];
  const keys = store.keys.filter((k) => k.provider === provider);
  if (activeId) {
    const match = keys.find((k) => k.id === activeId);
    if (match) return match;
  }
  return keys[0] ?? null;
}

export function saveAIKey(input: {
  provider: AIKeyProviderId;
  key: string;
  label?: string;
  id?: string;
}): StoredAIKey {
  const trimmed = input.key.trim();
  if (!trimmed) throw new Error("API key is required.");

  const store = readAIKeysStore();
  const existing = input.id ? store.keys.find((k) => k.id === input.id) : undefined;
  const label =
    input.label?.trim() ||
    existing?.label ||
    `Key ${store.keys.filter((k) => k.provider === input.provider).length + 1}`;

  const entry: StoredAIKey = existing
    ? { ...existing, key: trimmed, label }
    : {
        id: newAIKeyId(),
        provider: input.provider,
        label,
        key: trimmed,
        createdAt: new Date().toISOString(),
      };

  const keys = existing
    ? store.keys.map((k) => (k.id === entry.id ? entry : k))
    : [...store.keys, entry];

  writeAIKeysStore({
    keys,
    activeByProvider: { ...store.activeByProvider, [input.provider]: entry.id },
  });
  return entry;
}

export function removeAIKey(id: string): void {
  const store = readAIKeysStore();
  const removed = store.keys.find((k) => k.id === id);
  const keys = store.keys.filter((k) => k.id !== id);
  const activeByProvider = { ...store.activeByProvider };
  if (removed && activeByProvider[removed.provider] === id) {
    const next = keys.find((k) => k.provider === removed.provider);
    if (next) activeByProvider[removed.provider] = next.id;
    else delete activeByProvider[removed.provider];
  }
  writeAIKeysStore({ keys, activeByProvider });
}

export function setActiveAIKey(provider: AIKeyProviderId, id: string): void {
  const store = readAIKeysStore();
  if (!store.keys.some((k) => k.id === id && k.provider === provider)) return;
  writeAIKeysStore({
    ...store,
    activeByProvider: { ...store.activeByProvider, [provider]: id },
  });
}

export function maskAIKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Keys to send with generate requests (browser only). */
export function resolveClientAIApiKeys(): ResolvedAIApiKeys {
  const out: ResolvedAIApiKeys = {};
  for (const provider of ["openai", "cursor", "anthropic"] as const) {
    const active = getActiveKeyForProvider(provider);
    if (active?.key.trim()) out[provider] = active.key.trim();
  }
  return out;
}

export function providerHasLocalKey(provider: AIKeyProviderId): boolean {
  return Boolean(getActiveKeyForProvider(provider)?.key.trim());
}
