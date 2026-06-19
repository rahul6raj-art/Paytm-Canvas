import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";
import { nodeToReactStyle, type ReactStyleRecord } from "./reactStyle";
import {
  nodeMatchesCssRule,
  parsePageCssRules,
  type PageCssRule,
} from "./parsePageCss";

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Convert React inline style record → CSS declarations (kebab-case keys). */
export function reactStyleToCssDeclarations(style: ReactStyleRecord): Record<string, string> {
  const unitless = new Set([
    "font-weight",
    "opacity",
    "flex-grow",
    "flex-shrink",
    "z-index",
    "line-height",
    "order",
  ]);
  const decls: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === "") continue;
    const cssKey = camelToKebab(key);
    if (typeof value === "number") {
      decls[cssKey] = unitless.has(cssKey) ? String(value) : `${value}px`;
    } else {
      decls[cssKey] = String(value);
    }
  }
  return decls;
}

export function nodeToPageCssDeclarations(
  node: EditorNode,
  designTokens: Record<string, DesignToken>,
  opts?: { isFrameRoot?: boolean },
): Record<string, string> {
  const style = nodeToReactStyle(node, designTokens, {
    isFrameRoot: opts?.isFrameRoot,
  });
  return reactStyleToCssDeclarations(style);
}

function pickBestRule(codeClassName: string, rules: PageCssRule[]): PageCssRule | null {
  const matched = rules.filter((r) => nodeMatchesCssRule(codeClassName, r));
  if (matched.length === 0) return null;
  matched.sort((a, b) => a.classes.length - b.classes.length);
  return matched[matched.length - 1] ?? null;
}

function selectorFromClassName(codeClassName: string): string {
  const tokens = codeClassName.split(/\s+/).filter(Boolean);
  return `.${tokens.join(".")}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Update or append CSS rule blocks in existing file content. */
export function updatePageCssContent(
  cssText: string,
  selectorUpdates: Map<string, Record<string, string>>,
): string {
  let result = cssText.trimEnd();
  for (const [selector, decls] of selectorUpdates) {
    const blockRe = new RegExp(`${escapeRegExp(selector)}\\s*\\{[^}]*\\}`, "g");
    const existingMatch = result.match(blockRe);
    const mergedDecls: Record<string, string> = {};

    if (existingMatch?.[0]) {
      const inner = existingMatch[0].match(/\{([^}]*)\}/)?.[1] ?? "";
      for (const decl of inner.split(";")) {
        const idx = decl.indexOf(":");
        if (idx < 0) continue;
        const key = decl.slice(0, idx).trim().toLowerCase();
        const value = decl.slice(idx + 1).trim();
        if (key && value) mergedDecls[key] = value;
      }
    }

    for (const [key, value] of Object.entries(decls)) {
      mergedDecls[key.toLowerCase()] = value;
    }

    const declText = Object.entries(mergedDecls)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");

    if (existingMatch) {
      result = result.replace(blockRe, `${selector} {\n${declText}\n}`);
    } else {
      result += `\n\n${selector} {\n${declText}\n}`;
    }
  }
  return `${result}\n`;
}

/** Visual-only CSS props safe to sync from canvas → linked screen CSS (never layout geometry). */
const BRIDGE_SAFE_CSS_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "border-radius",
  "border-color",
  "border-width",
  "opacity",
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-align",
  "box-shadow",
]);

export function filterBridgeSafeCssDeclarations(
  decls: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(decls)) {
    const k = key.toLowerCase();
    if (!BRIDGE_SAFE_CSS_PROPS.has(k)) continue;
    out[k] = value;
  }
  return out;
}

export type ExportPageCssInput = {
  nodes: Record<string, EditorNode>;
  designTokens: Record<string, DesignToken>;
  /** Original CSS file contents keyed by relative path. */
  originalCssFiles: { path: string; content: string }[];
  /** When set, only these declaration keys are written (e.g. bridge safe filter). */
  filterDeclarations?: (decls: Record<string, string>) => Record<string, string>;
  /** Extra selector → declarations merged after canvas node styles (e.g. icon path → wrapper color). */
  extraSelectorUpdates?: Map<string, Record<string, string>>;
};

/** Build updated CSS files from canvas node styles (match by className). */
export function exportPageCssFiles(input: ExportPageCssInput): { path: string; content: string }[] {
  if (input.originalCssFiles.length === 0) return [];

  const allRules: PageCssRule[] = [];
  const rulesByFile: PageCssRule[][] = input.originalCssFiles.map((f) => {
    const rules = f.content?.trim() ? parsePageCssRules(f.content) : [];
    allRules.push(...rules);
    return rules;
  });

  const selectorToFileIdx = new Map<string, number>();
  input.originalCssFiles.forEach((_, idx) => {
    for (const rule of rulesByFile[idx]!) {
      selectorToFileIdx.set(rule.selector, idx);
    }
  });

  const selectorUpdates = new Map<string, Record<string, string>>();

  for (const node of Object.values(input.nodes)) {
    if (!node.codeClassName?.trim()) continue;
    const rawDecls = nodeToPageCssDeclarations(node, input.designTokens);
    const decls = input.filterDeclarations?.(rawDecls) ?? rawDecls;
    if (Object.keys(decls).length === 0) continue;

    const best = pickBestRule(node.codeClassName, allRules);
    const selector = best?.selector ?? selectorFromClassName(node.codeClassName);
    const prev = selectorUpdates.get(selector) ?? {};
    selectorUpdates.set(selector, { ...prev, ...decls });
  }

  for (const [selector, decls] of input.extraSelectorUpdates ?? []) {
    const filtered = input.filterDeclarations?.(decls) ?? decls;
    if (Object.keys(filtered).length === 0) continue;
    const prev = selectorUpdates.get(selector) ?? {};
    selectorUpdates.set(selector, { ...prev, ...filtered });
  }

  if (selectorUpdates.size === 0) {
    return input.originalCssFiles.map((f) => ({ path: f.path, content: f.content }));
  }

  const perFileUpdates: Map<string, Record<string, string>>[] = input.originalCssFiles.map(
    () => new Map(),
  );

  for (const [selector, decls] of selectorUpdates) {
    const fileIdx = selectorToFileIdx.get(selector) ?? 0;
    const prev = perFileUpdates[fileIdx]!.get(selector) ?? {};
    perFileUpdates[fileIdx]!.set(selector, { ...prev, ...decls });
  }

  return input.originalCssFiles.map((file, idx) => {
    const updates = perFileUpdates[idx]!;
    if (updates.size === 0) return { path: file.path, content: file.content };
    return {
      path: file.path,
      content: updatePageCssContent(file.content, updates),
    };
  });
}
