import { NextResponse } from "next/server";
import {
  buildGithubAuthUrl,
  buildGoogleAuthUrl,
  craftAppUrl,
  createOAuthState,
  parseOAuthProvider,
  readGithubOAuthConfig,
  readGoogleOAuthConfig,
  sanitizeOAuthNextPath,
  isGoogleOAuthDevMockEnabled,
  isGithubOAuthDevMockEnabled,
} from "@/lib/oauth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerRaw } = await params;
  const provider = parseOAuthProvider(providerRaw);
  if (!provider) {
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_invalid_provider`);
  }

  const url = new URL(request.url);
  const next = sanitizeOAuthNextPath(url.searchParams.get("next"));
  const state = createOAuthState(provider, next);

  if (provider === "google") {
    const config = readGoogleOAuthConfig("api");
    if (config) {
      return NextResponse.redirect(
        buildGoogleAuthUrl({
          clientId: config.clientId,
          redirectUri: config.redirectUri,
          state,
        }),
      );
    }
    if (isGoogleOAuthDevMockEnabled()) {
      return NextResponse.redirect(
        `${craftAppUrl()}/api/v1/auth/oauth/google/mock?state=${encodeURIComponent(state)}`,
      );
    }
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
  }

  const config = readGithubOAuthConfig("api");
  if (config) {
    return NextResponse.redirect(
      buildGithubAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state,
      }),
    );
  }
  if (isGithubOAuthDevMockEnabled()) {
    return NextResponse.redirect(
      `${craftAppUrl()}/api/v1/auth/oauth/github/mock?state=${encodeURIComponent(state)}`,
    );
  }
  return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
}
