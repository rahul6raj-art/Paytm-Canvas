import {
  PAYTM_CRAFT_DOCUMENT_STORAGE_KEY,
  readLocalDocument,
  writeLocalDocument,
  type PaytmCraftDocument,
} from "@/lib/documentPersistence";
import { ApiSyncProvider } from "@/lib/apiSyncProvider";
import { getPaytmCraftPublicEnv } from "@/lib/env";

/** Future: Yjs update, JSON Patch, or opaque server envelope. */
export type DocumentPatch = Uint8Array | Record<string, unknown>;

export type PresencePayload = Record<string, unknown>;

export interface SyncProvider {
  readonly kind: "local" | "api" | "remote";

  loadDocument(): Promise<PaytmCraftDocument | null>;

  saveDocument(document: PaytmCraftDocument): Promise<void>;

  /**
   * Local: emits current document once, then listens for `storage` (other tabs).
   * Remote (future): subscribes to websocket feed.
   */
  subscribeToDocument(onChange: (document: PaytmCraftDocument | null) => void): () => void;

  /** Local: no-op. Remote: broadcast Yjs / patch to peers. */
  publishPatch(patch: DocumentPatch): Promise<void>;

  connectPresence(_fileId: string): Promise<void>;

  disconnectPresence(): Promise<void>;
}

/**
 * Browser `localStorage` persistence — matches today’s editor behavior.
 * Safe to adopt later from a single initialization point without changing Zustand internals yet.
 */
export class LocalSyncProvider implements SyncProvider {
  readonly kind = "local" as const;

  async loadDocument(): Promise<PaytmCraftDocument | null> {
    return readLocalDocument();
  }

  async saveDocument(document: PaytmCraftDocument): Promise<void> {
    writeLocalDocument(document);
  }

  subscribeToDocument(onChange: (document: PaytmCraftDocument | null) => void): () => void {
    const emit = () => {
      try {
        onChange(readLocalDocument());
      } catch {
        onChange(null);
      }
    };

    queueMicrotask(emit);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== PAYTM_CRAFT_DOCUMENT_STORAGE_KEY) return;
      emit();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }

  async publishPatch(_patch: DocumentPatch): Promise<void> {
    void _patch;
    /* Single-writer local mode: patches are applied in-memory; saveDocument persists. */
  }

  async connectPresence(_fileId: string): Promise<void> {
    void _fileId;
  }

  async disconnectPresence(): Promise<void> {}
}

/**
 * HTTP + optional Yjs realtime for `remote` mode.
 */
export class RemoteSyncProvider implements SyncProvider {
  readonly kind = "remote" as const;

  private readonly http = new ApiSyncProvider("remote");

  loadDocument(): Promise<PaytmCraftDocument | null> {
    return this.http.loadDocument();
  }

  saveDocument(document: PaytmCraftDocument): Promise<void> {
    return this.http.saveDocument(document);
  }

  subscribeToDocument(onChange: (document: PaytmCraftDocument | null) => void): () => void {
    return this.http.subscribeToDocument(onChange);
  }

  async publishPatch(patch: DocumentPatch): Promise<void> {
    return this.http.publishPatch(patch);
  }

  connectPresence(fileId: string): Promise<void> {
    return this.http.connectPresence(fileId);
  }

  async disconnectPresence(): Promise<void> {
    return this.http.disconnectPresence();
  }
}

/** Factory for future wiring (`NEXT_PUBLIC_PAYTM_CRAFT_MODE`). */
export function createSyncProvider(): SyncProvider {
  const mode = getPaytmCraftPublicEnv().mode;
  if (mode === "remote") return new RemoteSyncProvider();
  if (mode === "api") return new ApiSyncProvider("api");
  return new LocalSyncProvider();
}
