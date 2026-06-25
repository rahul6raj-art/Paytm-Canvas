import { NextResponse } from "next/server";
import {
  craftAppUrl,
  googleOAuthDevMockProfile,
  isGoogleOAuthDevMockEnabled,
  verifyOAuthState,
} from "@/lib/oauth";
import { mockApiStore } from "@/lib/mockApiStore";
import { buildMockApiSessionCookie } from "@/lib/mockApiSession";

export async function GET(request: Request) {
  if (!isGoogleOAuthDevMockEnabled()) {
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_not_configured`);
  }

  const url = new URL(request.url);
  const stateRaw = url.searchParams.get("state") ?? "";
  const verified = verifyOAuthState(stateRaw);
  if (!verified || verified.provider !== "google") {
    return NextResponse.redirect(`${craftAppUrl()}/login?error=oauth_invalid_state`);
  }

  const profile = googleOAuthDevMockProfile();
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
}
