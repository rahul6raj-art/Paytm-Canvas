import { apiClient, ApiRequestError } from "@/lib/apiClient";
import { getPaytmCraftPublicEnv, isPaytmCraftRealtimeEnabled } from "@/lib/env";
import {
  connectRealtimeSync,
  disconnectRealtimeSync,
  getRealtimeSyncStatus,
  isRealtimeSyncConnected,
  pushRealtimeDocument,
} from "@/lib/realtimeSyncClient";
import {
  readLocalDocument,
  validatePaytmCraftDocument,
  writeLocalDocument,
  type PaytmCraftDocument,
} from "@/lib/documentPersistence";
import type { DocumentPatch, SyncProvider } from "@/lib/syncProvider";
import { LocalSyncProvider } from "@/lib/syncProvider";

let activeApiFileId: string | null = null;
let activeApiRevision: string | null = null;

/** Binds the active mock/real API file session for {@link ApiSyncProvider}. */
export function setActiveApiFileId(fileId: string | null | undefined): void {
  activeApiFileId = fileId ?? null;
  if (!activeApiFileId) {
    activeApiRevision = null;
  }
}

export function getActiveApiFileId(): string | null {
  return activeApiFileId;
}

/** Tracks the last known server revision for optimistic concurrency (`If-Match`). */
export function setActiveApiRevision(revision: string | null | undefined): void {
  activeApiRevision = revision?.trim() ? revision.trim() : null;
}

export function getActiveApiRevision(): string | null {
  return activeApiRevision;
}

/** Thrown when the server rejects a save due to revision mismatch (HTTP 409). */
export class ApiSaveConflictError extends ApiRequestError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ApiSaveConflictError";
  }
}

export function isApiSaveConflictError(e: unknown): e is ApiSaveConflictError {
  return e instanceof ApiSaveConflictError;
}

export function documentFromApiPayload(json: unknown): PaytmCraftDocument | null {
  if (!json) return null;
  if (!validatePaytmCraftDocument(json)) return null;
  return json;
}

/**
 * HTTP-backed persistence for `api` (mock `/api/v1`) and `remote` (`NEXT_PUBLIC_PAYTM_CRAFT_API_URL`).
 * Always mirrors to localStorage; pushes to the server when a file session is active.
 */
export class ApiSyncProvider implements SyncProvider {
  readonly kind: "api" | "remote";

  private readonly local = new LocalSyncProvider();

  constructor(kind: "api" | "remote" = "api") {
    this.kind = kind;
  }

  async loadDocument(): Promise<PaytmCraftDocument | null> {
    const fileId = activeApiFileId;
    if (fileId) {
      try {
        const detail = await apiClient.getFile(fileId);
        if (detail?.revision) {
          activeApiRevision = detail.revision;
        }
        const fromApi = documentFromApiPayload(detail?.documentJson);
        if (fromApi) {
          writeLocalDocument(fromApi);
          return fromApi;
        }
      } catch (e) {
        console.warn("[Paytm Craft] API loadDocument failed; using local cache", e);
      }
    }
    return readLocalDocument();
  }

  async saveDocument(document: PaytmCraftDocument): Promise<void> {
    writeLocalDocument(document);
    const fileId = activeApiFileId;
    if (!fileId) return;
    try {
      const result = await apiClient.saveFile(
        fileId,
        { documentJson: document },
        activeApiRevision ? { revision: activeApiRevision } : undefined,
      );
      activeApiRevision = result.revision;
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "CONFLICT") {
        throw new ApiSaveConflictError(e.message);
      }
      throw e;
    }
  }

  subscribeToDocument(onChange: (document: PaytmCraftDocument | null) => void): () => void {
    return this.local.subscribeToDocument(onChange);
  }

  async publishPatch(patch: DocumentPatch): Promise<void> {
    if (!isPaytmCraftRealtimeEnabled() || !isRealtimeSyncConnected()) return;
    if (patch && typeof patch === "object" && !ArrayBuffer.isView(patch) && "version" in patch) {
      pushRealtimeDocument(patch as unknown as PaytmCraftDocument);
    }
  }

  async connectPresence(fileId: string): Promise<void> {
    if (!isPaytmCraftRealtimeEnabled()) return;
    connectRealtimeSync(fileId, getPaytmCraftPublicEnv().syncUrl);
    if (getRealtimeSyncStatus() === "error") {
      throw new Error("Realtime sync connection failed");
    }
  }

  async disconnectPresence(): Promise<void> {
    disconnectRealtimeSync();
  }
}
