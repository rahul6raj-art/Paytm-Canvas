export type OAuthProvider = "google" | "github";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type OAuthProvidersStatus = Record<OAuthProvider, boolean>;

export function parseOAuthProvider(raw: string): OAuthProvider | null {
  if (raw === "google" || raw === "github") return raw;
  return null;
}

export function sanitizeOAuthNextPath(raw: string | null | undefined): string {
  const value = (raw ?? "/").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
