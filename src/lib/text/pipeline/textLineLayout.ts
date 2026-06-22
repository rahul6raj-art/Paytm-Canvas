/** Epsilon for wrap width comparisons — avoids inconsistent breaks from float noise. */
export const TEXT_WRAP_EPSILON = 0.25;

export function wrapWidthFits(contentWidth: number, maxWidth: number): boolean {
  if (!Number.isFinite(maxWidth)) return true;
  return contentWidth <= maxWidth + TEXT_WRAP_EPSILON;
}

/** Break a long token by character when it exceeds the available width. */
export function breakLongToken(
  token: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  if (wrapWidthFits(measure(token), maxWidth)) return [token];
  const parts: string[] = [];
  let chunk = "";
  for (const ch of token) {
    const next = chunk + ch;
    if (!chunk || wrapWidthFits(measure(next), maxWidth)) {
      chunk = next;
    } else {
      parts.push(chunk);
      chunk = ch;
    }
  }
  if (chunk) parts.push(chunk);
  return parts.length > 0 ? parts : [token];
}

/** Split paragraph into tokens preserving whitespace runs for wrap decisions. */
export function tokenizeParagraphForWrap(paragraph: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (const ch of paragraph) {
    if (/\s/u.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(ch);
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export function isWhitespaceToken(token: string): boolean {
  return /^\s+$/u.test(token);
}
