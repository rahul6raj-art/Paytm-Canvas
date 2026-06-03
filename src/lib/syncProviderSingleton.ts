import { createSyncProvider, type SyncProvider } from "@/lib/syncProvider";

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
}
