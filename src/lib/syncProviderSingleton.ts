import { createSyncProvider, type SyncProvider } from "@/lib/syncProvider";
import { setActiveApiFileId, setActiveApiRevision } from "@/lib/apiSyncProvider";

let provider: SyncProvider | null = null;

/** Lazily constructed sync layer (defaults to {@link LocalSyncProvider} in local mode). */
export function getSyncProvider(): SyncProvider {
  if (!provider) {
    provider = createSyncProvider();
  }
  return provider;
}

/** Reset cached provider (unit tests only). */
export function resetSyncProviderForTests(): void {
  provider = null;
  setActiveApiFileId(null);
  setActiveApiRevision(null);
}
