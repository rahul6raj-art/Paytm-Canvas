const SIMPLE_KEY = /^[A-Za-z0-9+/-]$/;
const MODIFIER_KEY = /^[⌘⇧⌥⌃]+[A-Za-z0-9]$/;

/** Split native `title="Label (K)"` strings into Figma-style hint parts. */
export function parseEditorHintTitle(title: string): { label: string; shortcut?: string } {
  const match = title.match(/^(.+?)\s+\(([^)]+)\)(.*)$/);
  if (!match) return { label: title };

  const [, rawLabel, parenContent, rest] = match;
  const shortcutCandidate = parenContent.trim();
  const suffix = rest.replace(/^\s*[—–-]\s*/, "").trim();
  const label = suffix ? `${rawLabel!.trim()} — ${suffix}` : rawLabel!.trim();

  if (
    !shortcutCandidate.includes(" or ") &&
    (SIMPLE_KEY.test(shortcutCandidate) || MODIFIER_KEY.test(shortcutCandidate))
  ) {
    return { label, shortcut: shortcutCandidate };
  }

  return { label: title };
}
