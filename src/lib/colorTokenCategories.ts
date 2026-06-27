import type { DesignToken } from "@/lib/designTokens";
import { isColorValue } from "@/lib/designTokens";

export type ColorTokenCategoryId =
  | "background"
  | "surface"
  | "text"
  | "icon"
  | "border"
  | "brand"
  | "glass"
  | "semantic"
  | "primitive"
  | "other";

export type ColorTokenCategoryGroup = {
  id: ColorTokenCategoryId;
  label: string;
  tokens: DesignToken[];
};

/** Ordered rules — first prefix match wins. */
export const COLOR_TOKEN_CATEGORY_RULES: {
  id: ColorTokenCategoryId;
  label: string;
  prefixes: string[];
}[] = [
  { id: "background", label: "Background", prefixes: ["background-"] },
  { id: "surface", label: "Surface", prefixes: ["surface-"] },
  { id: "text", label: "Text", prefixes: ["text-"] },
  { id: "icon", label: "Icon", prefixes: ["icon-"] },
  { id: "border", label: "Border", prefixes: ["border-"] },
  { id: "brand", label: "Brand", prefixes: ["brand-", "colour-"] },
  { id: "glass", label: "Glass", prefixes: ["glass-"] },
  {
    id: "semantic",
    label: "Semantic",
    prefixes: [
      "actions-",
      "accent-",
      "positive-",
      "negative-",
      "warning-",
      "announcement-",
      "destructive-",
      "success-",
      "error-",
      "info-",
      "status-",
    ],
  },
  { id: "primitive", label: "Primitives", prefixes: ["primitive-"] },
];

export function colorTokenCategoryForName(name: string): ColorTokenCategoryId {
  const normalized = name.trim().toLowerCase();
  for (const rule of COLOR_TOKEN_CATEGORY_RULES) {
    if (rule.prefixes.some((prefix) => normalized.startsWith(prefix))) {
      return rule.id;
    }
  }
  return "other";
}

export function colorTokenCategoryLabel(id: ColorTokenCategoryId): string {
  if (id === "other") return "Other";
  return COLOR_TOKEN_CATEGORY_RULES.find((r) => r.id === id)?.label ?? "Other";
}

/** Group library color tokens into semantic sections (Text, Border, Background, …). */
export function groupColorDesignTokens(tokens: DesignToken[]): ColorTokenCategoryGroup[] {
  const colors = tokens.filter((t) => t.type === "color" && isColorValue(t.value));
  const buckets = new Map<ColorTokenCategoryId, DesignToken[]>();
  for (const rule of COLOR_TOKEN_CATEGORY_RULES) {
    buckets.set(rule.id, []);
  }
  buckets.set("other", []);

  for (const token of colors) {
    const category = colorTokenCategoryForName(token.name);
    buckets.get(category)!.push(token);
  }

  const groups: ColorTokenCategoryGroup[] = [];
  for (const rule of COLOR_TOKEN_CATEGORY_RULES) {
    const items = buckets.get(rule.id)!;
    if (items.length === 0) continue;
    items.sort((a, b) => a.name.localeCompare(b.name));
    groups.push({ id: rule.id, label: rule.label, tokens: items });
  }

  const other = buckets.get("other")!;
  if (other.length > 0) {
    other.sort((a, b) => a.name.localeCompare(b.name));
    groups.push({ id: "other", label: "Other", tokens: other });
  }

  return groups;
}

export function flattenGroupedColorTokens(groups: ColorTokenCategoryGroup[]): DesignToken[] {
  return groups.flatMap((g) => g.tokens);
}
