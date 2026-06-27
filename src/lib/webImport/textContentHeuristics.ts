/** Heuristics to avoid importing Tailwind/CSS utility strings as visible text. */

const TAILWIND_UTILITY =
  /^(?:relative|absolute|fixed|sticky|static|hidden|block|inline|flex|grid|contents|table|sr-only|container|mx-auto|space-[xy]-\d+|gap-\d+|p[trblxy]?-\d+|m[trblxy]?-\d+|w-(?:full|auto|\d+)|h-(?:full|auto|\d+)|min-h-screen|max-w-\w+|flex-\d+|grow|shrink|basis-\w+|items-\w+|justify-\w+|self-\w+|col-span-\d+|row-span-\d+|rounded(?:-\w+)?|border(?:-\w+)?|bg-\w+|text-\w+|font-\w+|leading-\w+|tracking-\w+|shadow(?:-\w+)?|overflow-\w+|z-\d+|top-\d+|left-\d+|right-\d+|bottom-\d+|inset-\d+|opacity-\d+|transition(?:-\w+)?|duration-\d+|ease-\w+|cursor-\w+|select-\w+|pointer-events-\w+|object-\w+)$/;

const GENERIC_COMPONENT_NAMES = new Set([
  "input",
  "button",
  "label",
  "image",
  "text",
  "link",
  "div",
  "span",
  "frame",
  "container",
]);

export function isTailwindUtilityText(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 64) return false;
  if (TAILWIND_UTILITY.test(t)) return true;
  if (
    !t.includes(" ") &&
    /^[\w:.[\]'\/%-]+$/.test(t) &&
    /^(text|bg|font|flex|gap|w-|h-|p-|m-|rounded|border|object-|md:|lg:|xl:|sm:)/.test(t)
  ) {
    return true;
  }
  if (/^[\w-]+-\d+(?:\.\d+)?$/.test(t) && !t.includes(" ")) return true;
  return false;
}

export function isGenericComponentLabel(text: string, role?: string): boolean {
  const t = text.trim().toLowerCase();
  if (!GENERIC_COMPONENT_NAMES.has(t)) return false;
  return Boolean(role && t === role);
}

export function isImportableTextContent(
  text: string | undefined,
  opts?: { className?: string; role?: string; tagName?: string },
): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 1) return false;
  if (isTailwindUtilityText(trimmed)) return false;
  if (isGenericComponentLabel(trimmed, opts?.role)) return false;
  if (opts?.className) {
    const tokens = opts.className.split(/\s+/);
    if (tokens.includes(trimmed)) return false;
  }
  const tag = (opts?.tagName ?? "").toLowerCase();
  if (tag === "div" && trimmed.length < 24 && !/\s/.test(trimmed) && trimmed.includes("-")) {
    return false;
  }
  return true;
}

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "label", "a", "li", "button", "strong", "em", "small", "figcaption",
]);

export function isSemanticTextTag(tagName: string): boolean {
  return TEXT_TAGS.has(tagName.toLowerCase());
}
