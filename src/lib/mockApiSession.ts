export const MOCK_API_SESSION_COOKIE = "craft_sid";

const SESSION_DAYS = 30;

export function mockApiSessionMaxAgeSeconds(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

export function mockApiSessionExpiresAt(): string {
  return new Date(Date.now() + mockApiSessionMaxAgeSeconds() * 1000).toISOString();
}

export function buildMockApiSessionCookie(token: string): string {
  const maxAge = mockApiSessionMaxAgeSeconds();
  return `${MOCK_API_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearMockApiSessionCookie(): string {
  return `${MOCK_API_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseMockApiCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq)] = decodeURIComponent(trimmed.slice(eq + 1));
  }
  return out;
}

export function mockApiUserDto(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
  };
}
