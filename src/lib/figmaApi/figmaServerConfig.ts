export type FigmaServerConfig = {
  serverTokenConfigured: boolean;
  serverTokenValid: boolean;
  serverUser: { id: string; email: string; handle: string; imgUrl?: string } | null;
};

let cached: { at: number; config: FigmaServerConfig } | null = null;
const CACHE_MS = 60_000;

export async function fetchFigmaServerConfig(options?: {
  force?: boolean;
}): Promise<FigmaServerConfig> {
  if (
    !options?.force &&
    cached &&
    Date.now() - cached.at < CACHE_MS
  ) {
    return cached.config;
  }
  try {
    const res = await fetch("/api/import-figma/config");
    const json = (await res.json()) as Partial<FigmaServerConfig>;
    const config: FigmaServerConfig = {
      serverTokenConfigured: Boolean(json.serverTokenConfigured),
      serverTokenValid: Boolean(json.serverTokenValid),
      serverUser: json.serverUser ?? null,
    };
    cached = { at: Date.now(), config };
    return config;
  } catch {
    return {
      serverTokenConfigured: false,
      serverTokenValid: false,
      serverUser: null,
    };
  }
}

export function clearFigmaServerConfigCache(): void {
  cached = null;
}
