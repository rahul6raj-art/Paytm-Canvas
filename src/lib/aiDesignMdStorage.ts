import type { AIContextAttachment } from "@/lib/aiGenerateContext";
import { isBuiltinDesignMdId } from "@/lib/builtinDesignMd";

const UPLOADS_KEY = "paytm-craft:ai-design-md-uploads";
const SELECTED_KEY = "paytm-craft:ai-design-md-selected";
const MAX_STORED_UPLOADS = 24;

type StoredDesignMdUpload = {
  id: string;
  name: string;
  size: number;
  summary: string;
};

function isUserDesignMdUpload(ref: AIContextAttachment): ref is AIContextAttachment & { summary: string } {
  return (
    ref.kind === "design-md" &&
    !isBuiltinDesignMdId(ref.id) &&
    ref.status === "ready" &&
    Boolean(ref.summary?.trim())
  );
}

function toStored(ref: AIContextAttachment & { summary: string }): StoredDesignMdUpload {
  return {
    id: ref.id,
    name: ref.name,
    size: ref.size,
    summary: ref.summary.trim(),
  };
}

function fromStored(row: StoredDesignMdUpload): AIContextAttachment {
  return {
    id: row.id,
    kind: "design-md",
    name: row.name,
    size: row.size,
    status: "ready",
    summary: row.summary,
  };
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadStoredDesignMdUploads(): AIContextAttachment[] {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(UPLOADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDesignMdUpload[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r?.id && r?.name && r?.summary)
      .slice(0, MAX_STORED_UPLOADS)
      .map(fromStored);
  } catch {
    return [];
  }
}

export function saveStoredDesignMdUploads(refs: AIContextAttachment[]): void {
  const ls = storage();
  if (!ls) return;
  try {
    const rows = refs.filter(isUserDesignMdUpload).map(toStored).slice(0, MAX_STORED_UPLOADS);
    ls.setItem(UPLOADS_KEY, JSON.stringify(rows));
  } catch {
    /* quota or private mode */
  }
}

export function loadStoredSelectedDesignMdId(): string | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const id = ls.getItem(SELECTED_KEY);
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function saveStoredSelectedDesignMdId(id: string | null): void {
  const ls = storage();
  if (!ls) return;
  try {
    if (id) ls.setItem(SELECTED_KEY, id);
    else ls.removeItem(SELECTED_KEY);
  } catch {
    /* ignore */
  }
}

/** Keep selection valid after reload — builtin ids and stored upload ids only. */
export function normalizeStoredSelection(
  selectedId: string | null,
  uploads: AIContextAttachment[],
): string | null {
  if (!selectedId) return null;
  if (isBuiltinDesignMdId(selectedId)) return selectedId;
  return uploads.some((u) => u.id === selectedId) ? selectedId : null;
}
