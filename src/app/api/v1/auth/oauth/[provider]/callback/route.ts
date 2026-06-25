import { NextResponse } from "next/server";
import {
  craftAppUrl,
  exchangeGithubCode,
  exchangeGoogleCode,
  parseOAuthProvider,
  readGithubOAuthConfig,
  readGoogleOAuthConfig,
  verifyOAuthState,
} from "@/lib/oauth";
import { mockApiStore } from "@/lib/mockApiStore";
import { buildMockApiSessionCookie } from "@/lib/mockApiSession";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerRaw } = await params;
  const providerParam = parseOAuthProvider(providerRaw);
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_denied`);
  }

  const code = url.searchParams.get("code") ?? "";
  const stateRaw = url.searchParams.get("state") ?? "";
  const verified = verifyOAuthState(stateRaw);
  if (!providerParam || !verified || verified.provider !== providerParam || !code) {
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_invalid_state`);
  }

  try {
    let profile;
    if (providerParam === "google") {
      const config = readGoogleOAuthConfig("api");
      if (!config) throw new Error("Google OAuth is not configured");
      profile = await exchangeGoogleCode({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
    } else {
      const config = readGithubOAuthConfig("api");
      if (!config) throw new Error("GitHub OAuth is not configured");
      profile = await exchangeGithubCode({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
    }

    const { token } = mockApiStore.findOrCreateUserFromOAuth({
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });

    const response = NextResponse.redirect(`${craftAppUrl()}${verified.next}`);
    response.headers.set("Set-Cookie", buildMockApiSessionCookie(token));
    return response;
  } catch (e) {
    console.error("[mock-api] OAuth callback failed", e);
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_failed`);
  }
}
