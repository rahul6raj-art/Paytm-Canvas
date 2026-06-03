const LEGACY_EMAIL_KEY = "paytm-craft-figma-connection-v1";
const PROFILE_STORAGE_KEY = "paytm-craft-figma-profile-v2";
const TOKEN_STORAGE_KEY = "paytm-craft-figma-token-v1";

export type FigmaConnectionSource = "personal" | "server";

export type FigmaConnectionProfile = {
  id: string;
  email: string;
  handle: string;
  imgUrl?: string;
  source: FigmaConnectionSource;
};

/** @deprecated Use readFigmaConnectionProfile */
export function readFigmaConnectionEmail(): string | null {
  return readFigmaConnectionProfile()?.email ?? null;
}

/** @deprecated Use writeFigmaConnectionProfile */
export function writeFigmaConnectionEmail(email: string | null): void {
  if (!email) {
    writeFigmaConnectionProfile(null);
    return;
  }
  writeFigmaConnectionProfile({
    id: "legacy",
    email,
    handle: email.split("@")[0] || "Figma",
    source: "personal",
  });
}

export function readFigmaConnectionProfile(): FigmaConnectionProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      purgeLegacyMockConnection();
      return null;
    }
    const parsed = JSON.parse(raw) as FigmaConnectionProfile;
    if (!parsed?.email || !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFigmaConnectionProfile(profile: FigmaConnectionProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    if (profile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      localStorage.removeItem(LEGACY_EMAIL_KEY);
    } else {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      localStorage.removeItem(LEGACY_EMAIL_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Removes old mock-only email entries that were never verified with Figma. */
function purgeLegacyMockConnection(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_EMAIL_KEY);
    if (legacy) localStorage.removeItem(LEGACY_EMAIL_KEY);
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

export function clearFigmaConnection(): void {
  writeFigmaConnectionProfile(null);
  writeFigmaAccessToken(null);
}

export { isFigmaDesignUrl } from "@/integrations/figma/parse-figma-url";
