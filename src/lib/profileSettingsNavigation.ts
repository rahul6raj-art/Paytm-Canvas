export function sanitizeProfileReturnPath(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/settings/profile" || value.startsWith("/settings/profile?")) return null;
  return value;
}

export function profileSettingsHref(returnTo?: string | null): string {
  const safe = sanitizeProfileReturnPath(returnTo ?? null);
  if (!safe) return "/settings/profile";
  return `/settings/profile?return=${encodeURIComponent(safe)}`;
}

export function resolveProfileSettingsCloseTarget(returnParam: string | null | undefined): string | null {
  return sanitizeProfileReturnPath(returnParam ?? null);
}
