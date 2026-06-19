import type { PaytmCraftDocument } from "@/lib/documentPersistence";
import { validatePaytmCraftDocument } from "@/lib/documentPersistence";

export const DASHBOARD_SAVED_FILES_STORAGE_KEY = "paytm-craft-dashboard-saved-files-v1";

export type DashboardSavedFile = {
  id: string;
  name: string;
  savedAt: string;
  workspaceId: string;
  document: PaytmCraftDocument;
};

type SavedFilesListener = () => void;
const listeners = new Set<SavedFilesListener>();

export function subscribeDashboardSavedFiles(listener: SavedFilesListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyDashboardSavedFilesChanged(): void {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("paytm-craft-dashboard-files-changed"));
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSavedFiles(raw: unknown): DashboardSavedFile[] {
  if (!Array.isArray(raw)) return [];
  const out: DashboardSavedFile[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || typeof item.name !== "string") continue;
    if (typeof item.savedAt !== "string" || typeof item.workspaceId !== "string") continue;
    if (!validatePaytmCraftDocument(item.document)) continue;
    out.push({
      id: item.id,
      name: item.name,
      savedAt: item.savedAt,
      workspaceId: item.workspaceId,
      document: item.document,
    });
  }
  return out;
}

export function readDashboardSavedFiles(): DashboardSavedFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DASHBOARD_SAVED_FILES_STORAGE_KEY);
    if (!raw) return [];
    return parseSavedFiles(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeDashboardSavedFiles(files: DashboardSavedFile[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_SAVED_FILES_STORAGE_KEY, JSON.stringify(files));
    notifyDashboardSavedFilesChanged();
  } catch (e) {
    console.warn("[Paytm Craft] Could not save dashboard files", e);
  }
}

export function addDashboardSavedFile(file: DashboardSavedFile): void {
  const files = readDashboardSavedFiles();
  writeDashboardSavedFiles([file, ...files.filter((f) => f.id !== file.id)]);
}

export function removeDashboardSavedFile(fileId: string): void {
  writeDashboardSavedFiles(readDashboardSavedFiles().filter((f) => f.id !== fileId));
}

export function formatDashboardSavedFileEdited(savedAt: string): string {
  const ts = Date.parse(savedAt);
  if (!Number.isFinite(ts)) return "Recently";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
