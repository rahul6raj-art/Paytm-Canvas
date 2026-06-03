/** Server-only Figma configuration (never embed token in client bundles). */

function readEnv(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

export function getFigmaServerAccessToken(): string {
  return readEnv("FIGMA_ACCESS_TOKEN");
}

export function hasFigmaServerAccessToken(): boolean {
  return getFigmaServerAccessToken().length > 0;
}

export function getFigmaApiBaseUrl(): string {
  return readEnv("FIGMA_API_BASE_URL") || "https://api.figma.com/v1";
}
