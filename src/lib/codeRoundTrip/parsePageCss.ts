/** Parse page-level CSS into class → declaration maps (compound selectors supported). */

export type PageCssRule = {
  selector: string;
  classes: string[];
  declarations: Record<string, string>;
};

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function parsePageCssRules(cssText: string): PageCssRule[] {
  const rules: PageCssRule[] = [];
  const cleaned = stripCssComments(cssText);
  const re = /([.#][a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    const selector = match[1]!.trim();
    if (!selector.startsWith(".")) continue;
    const classes = selector
      .slice(1)
      .split(".")
      .map((c) => c.trim())
      .filter(Boolean);
    if (classes.length === 0) continue;
    const block = match[2] ?? "";
    const declarations: Record<string, string> = {};
    for (const decl of block.split(";")) {
      const idx = decl.indexOf(":");
      if (idx < 0) continue;
      const key = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (key && value) declarations[key] = value;
    }
    if (Object.keys(declarations).length > 0) {
      rules.push({ selector, classes, declarations });
    }
  }
  return rules;
}

export function nodeMatchesCssRule(codeClassName: string | undefined, rule: PageCssRule): boolean {
  if (!codeClassName?.trim()) return false;
  const tokens = new Set(codeClassName.split(/\s+/).filter(Boolean));
  return rule.classes.every((c) => tokens.has(c));
}
