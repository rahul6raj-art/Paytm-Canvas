import type { AIContextAttachment } from "@/lib/aiGenerateContext";
import { attachmentFromDesignMdText } from "@/lib/aiGenerateContext";
import {
  BUILTIN_DESIGN_MD_BY_ID,
  BUILTIN_DESIGN_MD_CATALOG,
  type BuiltinDesignMdEntry,
} from "@/lib/builtinDesignMdCatalog";

export const BUILTIN_DESIGN_MD_ID_PREFIX = "builtin:";

export function builtinDesignMdId(slug: string): string {
  return `${BUILTIN_DESIGN_MD_ID_PREFIX}${slug}`;
}

export function isBuiltinDesignMdId(id: string | null): id is string {
  return typeof id === "string" && id.startsWith(BUILTIN_DESIGN_MD_ID_PREFIX);
}

export function builtinSlugFromId(id: string): string {
  return id.slice(BUILTIN_DESIGN_MD_ID_PREFIX.length);
}

export function builtinDesignMdEntry(id: string): BuiltinDesignMdEntry | undefined {
  if (!isBuiltinDesignMdId(id)) return undefined;
  return BUILTIN_DESIGN_MD_BY_ID[builtinSlugFromId(id)];
}

export function builtinDesignMdGroups(search: string): { category: string; entries: BuiltinDesignMdEntry[] }[] {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? BUILTIN_DESIGN_MD_CATALOG.filter(
        (e) => e.label.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
      )
    : BUILTIN_DESIGN_MD_CATALOG;

  const byCategory = new Map<string, BuiltinDesignMdEntry[]>();
  for (const entry of filtered) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  return [...byCategory.entries()].map(([category, entries]) => ({ category, entries }));
}

const attachmentCache = new Map<string, AIContextAttachment>();

export async function loadBuiltinDesignMdAttachment(slug: string): Promise<AIContextAttachment> {
  const entry = BUILTIN_DESIGN_MD_BY_ID[slug];
  if (!entry) {
    return {
      id: builtinDesignMdId(slug),
      kind: "design-md",
      name: slug,
      size: 0,
      status: "error",
      error: "Unknown design system",
    };
  }

  const cacheKey = entry.id;
  const cached = attachmentCache.get(cacheKey);
  if (cached?.status === "ready") return cached;

  try {
    const res = await fetch(entry.path);
    if (!res.ok) throw new Error(`Could not load ${entry.label} DESIGN.md`);
    const text = await res.text();
    const attachment = attachmentFromDesignMdText(builtinDesignMdId(entry.id), `${entry.label} DESIGN.md`, text, entry.size);
    attachmentCache.set(cacheKey, attachment);
    return attachment;
  } catch (err) {
    const failed: AIContextAttachment = {
      id: builtinDesignMdId(entry.id),
      kind: "design-md",
      name: `${entry.label} DESIGN.md`,
      size: entry.size,
      status: "error",
      error: err instanceof Error ? err.message : "Failed to load design system",
    };
    return failed;
  }
}
