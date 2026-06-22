import type { EditorState } from "@/stores/useEditorStore";
import { EDITOR_MENUS, resolveMenuItem, type MenuItemDef, type ResolvedMenuItem } from "./editorMenuConfig";

export type LogoMenuRootEntry =
  | { type: "divider" }
  | { type: "command"; commandId: string; label?: string }
  | {
      type: "action";
      label: string;
      shortcut?: string;
      enabled?: (s: EditorState) => boolean;
      run: (s: EditorState) => void;
    }
  | { type: "link"; label: string; href: string }
  | { type: "submenu"; menuId: string; label?: string };

export type SubmenuEntryDef =
  | { type: "divider" }
  | { type: "command"; commandId: string; label?: string }
  | {
      type: "action";
      label: string;
      shortcut?: string;
      enabled?: (s: EditorState) => boolean;
      run: (s: EditorState) => void;
    }
  | { type: "submenu"; id: string; label: string; items: SubmenuEntryDef[] };

/** Insert menu — tools grouped like Figma (Frame, Text, Shapes ›, etc.). */
export const INSERT_MENU: SubmenuEntryDef[] = [
  { type: "command", commandId: "tool-frame", label: "Frame" },
  { type: "command", commandId: "tool-text", label: "Text" },
  {
    type: "submenu",
    id: "shapes",
    label: "Shapes",
    items: [
      { type: "command", commandId: "tool-rect", label: "Rectangle" },
      { type: "command", commandId: "tool-ellipse", label: "Ellipse" },
      { type: "command", commandId: "tool-line", label: "Line" },
      { type: "command", commandId: "tool-arrow", label: "Arrow" },
      { type: "command", commandId: "tool-polygon", label: "Polygon" },
      { type: "command", commandId: "tool-star", label: "Star" },
      { type: "command", commandId: "tool-triangle", label: "Triangle" },
      { type: "command", commandId: "tool-pencil", label: "Pencil" },
    ],
  },
  { type: "command", commandId: "tool-pen", label: "Pen" },
  { type: "command", commandId: "tool-comment", label: "Comment" },
  { type: "divider" },
  { type: "command", commandId: "wrap-selection-in-frame", label: "Wrap in frame" },
  { type: "command", commandId: "add-auto-layout", label: "Add auto layout" },
];

/** Custom flyout menus keyed by id (used from logo menu submenus). */
export const EDITOR_CUSTOM_SUBMENUS: Record<string, SubmenuEntryDef[]> = {
  insert: INSERT_MENU,
};

/** Root logo menu — grouped sections with nested submenus for editor commands. */
export const EDITOR_LOGO_MENU_ROOT: LogoMenuRootEntry[] = [
  {
    type: "action",
    label: "Search…",
    shortcut: "⌘K",
    run: (s) => s.setCommandMenuOpen(true),
  },
  { type: "divider" },
  { type: "command", commandId: "export-document", label: "Export document…" },
  {
    type: "action",
    label: "Design ↔ Code (export)…",
    run: (s) => s.openCodeRoundTrip("export"),
  },
  {
    type: "action",
    label: "Design ↔ Code (import)…",
    run: (s) => s.openCodeRoundTrip("import"),
  },
  {
    type: "action",
    label: "Import file…",
    run: () => {
      document.querySelector<HTMLInputElement>("[data-editor-import-input]")?.click();
    },
  },
  {
    type: "action",
    label: "Import from Web…",
    run: (s) => s.openImportWebModal(),
  },
  {
    type: "action",
    label: "Import from Figma…",
    run: (s) => s.openImportFigmaModal(),
  },
  { type: "divider" },
  { type: "submenu", menuId: "file", label: "File" },
  { type: "submenu", menuId: "edit", label: "Edit" },
  { type: "submenu", menuId: "view", label: "View" },
  { type: "submenu", menuId: "insert", label: "Insert" },
  { type: "submenu", menuId: "object", label: "Object" },
  { type: "submenu", menuId: "text", label: "Text" },
  { type: "submenu", menuId: "arrange", label: "Arrange" },
  { type: "submenu", menuId: "pages", label: "Pages" },
  { type: "submenu", menuId: "plugins", label: "Plugins" },
  { type: "divider" },
  { type: "command", commandId: "open-help-demo-checklist", label: "Docs" },
  { type: "command", commandId: "open-mcp-connections", label: "MCP connections…" },
  { type: "command", commandId: "show-shortcuts", label: "Keyboard Shortcuts" },
];

export type ResolvedLogoMenuRootEntry =
  | { type: "divider" }
  | { type: "item"; item: ResolvedMenuItem }
  | { type: "link"; label: string; href: string }
  | { type: "submenu"; menuId: string; label: string };

export type ResolvedSubmenuEntry =
  | { type: "divider" }
  | { type: "item"; item: ResolvedMenuItem }
  | { type: "nested"; id: string; label: string; items: ResolvedSubmenuEntry[] };

function resolveSubmenuEntryDef(
  entry: SubmenuEntryDef,
  getState: () => EditorState,
): ResolvedSubmenuEntry | null {
  if (entry.type === "divider") return { type: "divider" };

  if (entry.type === "submenu") {
    const items: ResolvedSubmenuEntry[] = [];
    for (const child of entry.items) {
      const resolved = resolveSubmenuEntryDef(child, getState);
      if (resolved) items.push(resolved);
    }
    if (items.length === 0) return null;
    return { type: "nested", id: entry.id, label: entry.label, items };
  }

  if (entry.type === "command") {
    const resolved = resolveMenuItem({ type: "command", commandId: entry.commandId }, getState);
    if (!resolved) return null;
    return {
      type: "item",
      item: entry.label ? { ...resolved, label: entry.label } : resolved,
    };
  }

  const resolved = resolveMenuItem(entry as MenuItemDef, getState);
  return resolved ? { type: "item", item: resolved } : null;
}

export function resolveLogoMenuRootEntry(
  entry: LogoMenuRootEntry,
  getState: () => EditorState,
): ResolvedLogoMenuRootEntry | null {
  if (entry.type === "divider") return { type: "divider" };

  if (entry.type === "link") {
    return { type: "link", label: entry.label, href: entry.href };
  }

  if (entry.type === "submenu") {
    const custom = EDITOR_CUSTOM_SUBMENUS[entry.menuId];
    const menu = EDITOR_MENUS.find((m) => m.id === entry.menuId);
    if (!custom && !menu) return null;
    return {
      type: "submenu",
      menuId: entry.menuId,
      label: entry.label ?? menu?.label ?? entry.menuId,
    };
  }

  if (entry.type === "command") {
    const resolved = resolveMenuItem({ type: "command", commandId: entry.commandId }, getState);
    if (!resolved) return null;
    return {
      type: "item",
      item: entry.label ? { ...resolved, label: entry.label } : resolved,
    };
  }

  const resolved = resolveMenuItem(entry, getState);
  return resolved ? { type: "item", item: resolved } : null;
}

export function buildResolvedLogoMenuRoot(
  getState: () => EditorState,
): ResolvedLogoMenuRootEntry[] {
  const out: ResolvedLogoMenuRootEntry[] = [];
  for (const entry of EDITOR_LOGO_MENU_ROOT) {
    const resolved = resolveLogoMenuRootEntry(entry, getState);
    if (resolved) out.push(resolved);
  }
  return out;
}

export function buildResolvedSubmenuEntries(
  menuId: string,
  getState: () => EditorState,
): ResolvedSubmenuEntry[] {
  const custom = EDITOR_CUSTOM_SUBMENUS[menuId];
  if (custom) {
    const out: ResolvedSubmenuEntry[] = [];
    for (const entry of custom) {
      const resolved = resolveSubmenuEntryDef(entry, getState);
      if (resolved) out.push(resolved);
    }
    return out;
  }

  const menu = EDITOR_MENUS.find((m) => m.id === menuId);
  if (!menu) return [];
  const out: ResolvedSubmenuEntry[] = [];
  for (const item of menu.items as MenuItemDef[]) {
    if (item.type === "divider") {
      out.push({ type: "divider" });
      continue;
    }
    const resolved = resolveMenuItem(item, getState);
    if (resolved) out.push({ type: "item", item: resolved });
  }
  return out;
}

/** @deprecated Use buildResolvedSubmenuEntries */
export function buildResolvedSubmenuItems(
  menuId: string,
  getState: () => EditorState,
): (ResolvedMenuItem | "divider")[] {
  return buildResolvedSubmenuEntries(menuId, getState).flatMap(
    (entry): (ResolvedMenuItem | "divider")[] => {
      if (entry.type === "divider") return ["divider"];
      if (entry.type === "item") return [entry.item];
      return [];
    },
  );
}

export function logoMenuLabelForId(menuId: string): string {
  return EDITOR_MENUS.find((m) => m.id === menuId)?.label ?? menuId;
}
