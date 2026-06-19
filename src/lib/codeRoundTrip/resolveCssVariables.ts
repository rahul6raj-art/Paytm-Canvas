import {
  parseCssCustomProperties,
  type CssThemeScope,
} from "@/lib/codeRoundTrip/parseCssCustomProperties";

const VAR_REF = /var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/g;

function resolveVarChain(
  name: string,
  vars: Record<string, string>,
  stack: Set<string>,
): string | undefined {
  if (stack.has(name)) return undefined;
  const raw = vars[name];
  if (!raw) return undefined;
  stack.add(name);
  const resolved = resolveCssValue(raw, vars, stack);
  stack.delete(name);
  return resolved;
}

export function resolveCssValue(
  value: string,
  vars: Record<string, string>,
  stack: Set<string> = new Set(),
): string {
  return value.replace(VAR_REF, (_match, name: string, fallback?: string) => {
    const resolved = resolveVarChain(name, vars, stack);
    if (resolved != null) return resolved;
    if (fallback?.trim()) return resolveCssValue(fallback.trim(), vars, stack);
    return _match;
  });
}

export function resolveCssDeclarations(
  declarations: Record<string, string>,
  cssSources: string[],
  theme: CssThemeScope = "dark",
): Record<string, string> {
  const scopes = parseCssCustomProperties(cssSources);
  const vars = { ...scopes.light, ...scopes[theme] };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(declarations)) {
    out[key] = resolveCssValue(value, vars);
  }
  return out;
}
