import type { FigmaConnectionProfile } from "@/lib/figmaImportConnection";

type VerifyResponse = {
  user?: FigmaConnectionProfile;
  error?: string;
};

/** Calls POST /api/import-figma/verify with an optional personal access token. */
export async function verifyFigmaAccessToken(
  accessToken?: string,
): Promise<FigmaConnectionProfile> {
  const res = await fetch("/api/import-figma/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: accessToken?.trim() || undefined }),
  });
  const json = (await res.json()) as VerifyResponse;
  if (!res.ok || !json.user) {
    throw new Error(json.error ?? `Figma verification failed (${res.status})`);
  }
  return json.user;
}
