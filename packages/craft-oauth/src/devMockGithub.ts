import type { OAuthProfile } from "./types";

function readEnv(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw || undefined;
}

/** Local dev sign-in when real GitHub OAuth credentials are not configured. Opt in with CRAFT_OAUTH_GITHUB_DEV_MOCK=1. */
export function isGithubOAuthDevMockEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const override = readEnv("CRAFT_OAUTH_GITHUB_DEV_MOCK")?.toLowerCase();
  if (override !== "1" && override !== "true" && override !== "yes") return false;
  const clientId = readEnv("GITHUB_CLIENT_ID");
  const clientSecret = readEnv("GITHUB_CLIENT_SECRET");
  return !(clientId && clientSecret);
}

export function githubOAuthDevMockProfile(): OAuthProfile {
  return {
    provider: "github",
    providerAccountId: "dev-github-user",
    email: "github.dev@paytm.com",
    displayName: "GitHub Dev User",
    avatarUrl: null,
  };
}
