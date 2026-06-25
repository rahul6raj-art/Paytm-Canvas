import type { OAuthProfile } from "./types";

function readEnv(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw || undefined;
}

/** Local dev sign-in when real Google OAuth credentials are not configured. Opt in with CRAFT_OAUTH_GOOGLE_DEV_MOCK=1. */
export function isGoogleOAuthDevMockEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const override = readEnv("CRAFT_OAUTH_GOOGLE_DEV_MOCK")?.toLowerCase();
  if (override !== "1" && override !== "true" && override !== "yes") return false;
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET");
  return !(clientId && clientSecret);
}

export function googleOAuthDevMockProfile(): OAuthProfile {
  return {
    provider: "google",
    providerAccountId: "dev-google-user",
    email: "google.dev@paytm.com",
    displayName: "Google Dev User",
    avatarUrl: null,
  };
}
