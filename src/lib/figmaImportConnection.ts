const STORAGE_KEY = "paytm-craft-figma-connection-v1";
const TOKEN_STORAGE_KEY = "paytm-craft-figma-token-v1";

export function readFigmaConnectionEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeFigmaConnectionEmail(email: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (email) localStorage.setItem(STORAGE_KEY, email);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readFigmaAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeFigmaAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token?.trim()) localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isFigmaDesignUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!u.hostname.endsWith("figma.com")) return false;
    return (
      u.pathname.includes("/design/") ||
      u.pathname.includes("/file/") ||
      u.pathname.includes("/proto/") ||
      u.pathname.includes("/board/")
    );
  } catch {
    return false;
  }
}
