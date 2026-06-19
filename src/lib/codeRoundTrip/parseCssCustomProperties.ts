export type CssThemeScope = "light" | "dark";

function parseDeclBlock(block: string, target: Record<string, string>): void {
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
    target[m[1]!] = m[2]!.trim();
  }
}

/** Extract `--name: value` declarations from `:root` and `[data-theme='dark']` blocks. */
export function parseCssCustomProperties(
  cssSources: string[],
): Record<CssThemeScope, Record<string, string>> {
  const scopes: Record<CssThemeScope, Record<string, string>> = {
    light: {},
    dark: {},
  };

  for (const css of cssSources) {
    if (!css?.trim()) continue;
    for (const m of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
      parseDeclBlock(m[1]!, scopes.light);
    }
    for (const m of css.matchAll(/\[data-theme\s*=\s*['"]dark['"]\]\s*\{([^}]*)\}/gi)) {
      parseDeclBlock(m[1]!, scopes.dark);
    }
  }

  return scopes;
}
