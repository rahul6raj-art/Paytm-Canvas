/** URL validation for React live preview capture (Storybook, localhost dev server). */

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function validateReactPreviewUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Preview URL is required." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http and https preview URLs are allowed." };
  }

  const host = parsed.hostname.toLowerCase();
  if (LOOPBACK.has(host)) {
    return { ok: true, url: parsed.toString() };
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "Internal hostnames are not allowed." };
  }
  if (isPrivateIpv4(host)) {
    return { ok: false, error: "Private network URLs are only allowed for localhost / 127.0.0.1." };
  }

  return { ok: true, url: parsed.toString() };
}
