import { ollamaBaseUrl } from "@/lib/aiModels";

export type OllamaTagsResponse = {
  models?: { name: string; size?: number }[];
};

export async function isOllamaReachable(): Promise<boolean> {
  const base = ollamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchOllamaTags(): Promise<string[]> {
  const base = ollamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OllamaTagsResponse;
    return (data.models ?? []).map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export function ollamaTagInstalled(installed: string[], tag: string): boolean {
  if (!tag) return false;
  const norm = tag.toLowerCase();
  return installed.some((name) => {
    const n = name.toLowerCase();
    return n === norm || n.startsWith(`${norm}:`) || norm.startsWith(`${n}:`);
  });
}
