import type { OAuthProfile } from "./types";

type GithubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GithubUser = {
  id?: number;
  login?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type GithubEmail = {
  email?: string;
  primary?: boolean;
  verified?: boolean;
};

export function buildGithubAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: "read:user user:email",
    state: input.state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function resolveGithubEmail(accessToken: string, fallback?: string | null): Promise<string> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PaytmCraft",
    },
  });
  const rows = (await res.json().catch(() => [])) as GithubEmail[];
  if (res.ok && Array.isArray(rows)) {
    const primaryVerified = rows.find((row) => row.primary && row.verified && row.email);
    if (primaryVerified?.email) return primaryVerified.email.trim().toLowerCase();
    const verified = rows.find((row) => row.verified && row.email);
    if (verified?.email) return verified.email.trim().toLowerCase();
  }
  if (fallback?.trim()) return fallback.trim().toLowerCase();
  throw new Error("GitHub account has no verified email");
}

export async function exchangeGithubCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as GithubTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "GitHub token exchange failed");
  }

  const profileRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "PaytmCraft",
    },
  });
  const profile = (await profileRes.json().catch(() => ({}))) as GithubUser;
  if (!profileRes.ok || profile.id == null) {
    throw new Error("GitHub profile missing required fields");
  }

  const email = await resolveGithubEmail(tokenJson.access_token, profile.email);
  const displayName =
    profile.name?.trim() || profile.login?.trim() || email.split("@")[0] || "GitHub User";

  return {
    provider: "github",
    providerAccountId: String(profile.id),
    email,
    displayName,
    avatarUrl: profile.avatar_url ?? null,
  };
}
