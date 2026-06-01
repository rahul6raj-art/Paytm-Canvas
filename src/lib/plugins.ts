export type CraftPluginCategory = "Design" | "Productivity" | "Export" | "AI" | "Accessibility";

export interface CraftPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  category: CraftPluginCategory;
  /** Short label for cards (emoji ok) */
  icon: string;
  installed: boolean;
}

export const INSTALLED_PLUGINS_STORAGE_KEY = "paytm-craft-installed-plugins-v1";

export const MOCK_PLUGINS_CATALOG: Omit<CraftPlugin, "installed">[] = [
  {
    id: "contrast-checker",
    name: "Contrast Checker",
    description: "Estimate text/background contrast and WCAG-style pass hints from your selection.",
    author: "Paytm Craft",
    category: "Accessibility",
    icon: "◎",
  },
  {
    id: "icon-generator",
    name: "Icon Generator",
    description: "Drop a simple vector mark into the selected frame as a starting icon.",
    author: "Paytm Craft",
    category: "Design",
    icon: "◇",
  },
  {
    id: "lorem-ipsum",
    name: "Lorem Ipsum",
    description: "Fill selected text layers with placeholder copy (mock, deterministic).",
    author: "Paytm Craft",
    category: "Productivity",
    icon: "¶",
  },
  {
    id: "token-extractor",
    name: "Token Extractor",
    description: "Summarize colors, type sizes, and spacing tokens used across the document.",
    author: "Paytm Craft",
    category: "Design",
    icon: "◈",
  },
  {
    id: "export-react",
    name: "Export to React",
    description: "Preview a simple JSX snippet for the selected frame subtree.",
    author: "Paytm Craft",
    category: "Export",
    icon: "</>",
  },
  {
    id: "rename-layers",
    name: "Rename Layers",
    description: "Rename selected layers to clean, type-based names.",
    author: "Paytm Craft",
    category: "Productivity",
    icon: "✎",
  },
  {
    id: "accessibility-audit",
    name: "Accessibility Audit",
    description: "Run a deterministic mock checklist against the file and selection.",
    author: "Paytm Craft",
    category: "Accessibility",
    icon: "✓",
  },
];

export function readInstalledPluginIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INSTALLED_PLUGINS_STORAGE_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function writeInstalledPluginIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INSTALLED_PLUGINS_STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore quota */
  }
}

export function craftPluginsWithInstallState(installedIds: string[]): CraftPlugin[] {
  const set = new Set(installedIds);
  return MOCK_PLUGINS_CATALOG.map((p) => ({ ...p, installed: set.has(p.id) }));
}

export function getPluginById(id: string): Omit<CraftPlugin, "installed"> | undefined {
  return MOCK_PLUGINS_CATALOG.find((p) => p.id === id);
}
