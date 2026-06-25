const LAST_LOGIN_EMAIL_KEY = "paytm-craft-last-login-email-v1";
const SAVED_PASSWORDS_KEY = "paytm-craft-saved-login-passwords-v1";

export const DEFAULT_DEV_LOGIN_EMAIL = "rahul6.raj@paytm.com";
export const DEFAULT_DEV_SEED_PASSWORD = "1234";

type SavedPasswords = Record<string, string>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function readPrefillLoginEmail(): string {
  return readLastLoginEmail() || DEFAULT_DEV_LOGIN_EMAIL;
}

export function readLastLoginEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_LOGIN_EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeLastLoginEmail(email: string): void {
  if (typeof window === "undefined") return;
  const trimmed = email.trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(LAST_LOGIN_EMAIL_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

function readSavedPasswords(): SavedPasswords {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SAVED_PASSWORDS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: SavedPasswords = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.length > 0) {
        out[normalizeEmail(key)] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Dev convenience: remember the last password used per email on this device. */
export function readPrefillPassword(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized) return "";
  const saved = readSavedPasswords()[normalized];
  if (saved) return saved;
  if (normalized === normalizeEmail(DEFAULT_DEV_LOGIN_EMAIL)) {
    return DEFAULT_DEV_SEED_PASSWORD;
  }
  return "";
}

export function writeSavedLoginPassword(email: string, password: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return;
  try {
    const saved = readSavedPasswords();
    saved[normalized] = password;
    window.localStorage.setItem(SAVED_PASSWORDS_KEY, JSON.stringify(saved));
  } catch {
    /* ignore */
  }
}
