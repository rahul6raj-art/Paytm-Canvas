import {
  PAYTM_CRAFT_DOCUMENT_STORAGE_KEY,
  readLocalDocument,
  writeLocalDocument,
  type PaytmCraftDocument,
} from "@/lib/documentPersistence";
import { getPaytmCraftPublicEnv } from "@/lib/env";

/** Future: Yjs update, JSON Patch, or opaque server envelope. */
export type DocumentPatch = Uint8Array | Record<string, unknown>;

export type PresencePayload = Record<string, unknown>;

export interface SyncProvider {
  readonly kind: "local" | "remote";

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
 * Placeholder for Hocuspocus / Yjs websocket sync. Operations are no-ops or reject until implemented.
 */
export class RemoteSyncProvider implements SyncProvider {
  readonly kind = "remote" as const;

  loadDocument(): Promise<PaytmCraftDocument | null> {
    return Promise.reject(new Error("Remote sync not connected yet"));
  }

  saveDocument(_document: PaytmCraftDocument): Promise<void> {
    void _document;
    return Promise.reject(new Error("Remote sync not connected yet"));
  }

  subscribeToDocument(_onChange: (document: PaytmCraftDocument | null) => void): () => void {
    void _onChange;
    return () => {};
  }

  publishPatch(_patch: DocumentPatch): Promise<void> {
    void _patch;
    return Promise.reject(new Error("Remote sync not connected yet"));
  }

  connectPresence(_fileId: string): Promise<void> {
    void _fileId;
    return Promise.reject(new Error("Remote sync not connected yet"));
  }

  async disconnectPresence(): Promise<void> {}
}

/** Factory for future wiring (`NEXT_PUBLIC_PAYTM_CRAFT_MODE`). */
export function createSyncProvider(): SyncProvider {
  return getPaytmCraftPublicEnv().mode === "remote" ? new RemoteSyncProvider() : new LocalSyncProvider();
}
