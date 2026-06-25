import type { OAuthProvider, OAuthProvidersStatus } from "./types";

function readEnv(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw || undefined;
}

export function craftAppUrl(): string {
  return readEnv("CRAFT_APP_URL") || readEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
}

export function oauthCallbackBaseUrl(mode: "api" | "remote"): string {
  if (mode === "api") {
    return `${craftAppUrl().replace(/\/$/, "")}/api/v1/auth/oauth`;
  }
  const publicUrl =
    readEnv("CRAFT_API_PUBLIC_URL") ||
    `http://localhost:${readEnv("CRAFT_API_PORT") || "4000"}`;
  return `${publicUrl.replace(/\/$/, "")}/v1/auth/oauth`;
}

export function oauthCallbackUrl(provider: OAuthProvider, mode: "api" | "remote"): string {
  return `${oauthCallbackBaseUrl(mode)}/${provider}/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(readEnv("GOOGLE_CLIENT_ID") && readEnv("GOOGLE_CLIENT_SECRET"));
}

export function isGithubOAuthConfigured(): boolean {
  return Boolean(readEnv("GITHUB_CLIENT_ID") && readEnv("GITHUB_CLIENT_SECRET"));
}

export function readOAuthProvidersStatus(): OAuthProvidersStatus {
  return {
    google: isGoogleOAuthConfigured(),
    github: isGithubOAuthConfigured(),
  };
}

export function readGoogleOAuthConfig(mode: "api" | "remote") {
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: oauthCallbackUrl("google", mode),
  };
}

export function readGithubOAuthConfig(mode: "api" | "remote") {
  const clientId = readEnv("GITHUB_CLIENT_ID");
  const clientSecret = readEnv("GITHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: oauthCallbackUrl("github", mode),
  };
}
