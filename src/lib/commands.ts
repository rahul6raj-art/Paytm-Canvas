import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { canCreateComponentFromSelection, findInstanceRoot } from "@/lib/componentModel";
import { topLevelSelectedIds } from "@/lib/editorGraph";
import { hasEditorClipboardContent } from "@/lib/editorClipboardAvailability";
import type { EditorState, Tool } from "@/stores/useEditorStore";

export type CommandCategory =
  | "Tools"
  | "Editing"
  | "Arrange"
  | "Actions"
  | "Modes"
  | "Files"
  | "View"
  | "Plugins"
  | "Workspace";

export interface CommandDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: CommandCategory;
  /** Display hint, e.g. "⌘D" (formatted in UI on non‑Mac). */
  shortcut: string;
  keywords?: string[];
  enabled: (s: EditorState) => boolean;
  run: (s: EditorState) => void;
}

const RECENT_KEY = "paytm-craft-recent-commands-v1";
const MAX_RECENT = 5;

function hasClippableTops(s: EditorState) {
  return topLevelSelectedIds(s.selectedIds, s.nodes).some((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
}

function canPasteFromClipboard(s: EditorState) {
  return inDesign(s) && hasEditorClipboardContent();
}

function alignEligible(s: EditorState) {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  return (
    tops.length >= 2 &&
    tops.every((id) => {
      const n = s.nodes[id];
      return n && !n.locked && n.visible;
    })
  );
}

function distributeEligible(s: EditorState) {
  if (!inDesign(s)) return false;
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  return tops.length >= 3;
}

function hasSelection(s: EditorState) {
  return s.selectedIds.length > 0;
}

export function readRecentCommandIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentCommandId(commandId: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = readRecentCommandIds().filter((id) => id !== commandId);
    const next = [commandId, ...prev].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

function inDesign(s: EditorState) {
  return s.editorMode === "design";
}

function groupEligible(s: EditorState) {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length < 2) return false;
  const parentId = s.nodes[tops[0]!]!.parentId;
  return tops.every((id) => s.nodes[id]!.parentId === parentId);
}

function ungroupEligible(s: EditorState) {
  if (s.selectedIds.length !== 1) return false;
  const g = s.nodes[s.selectedIds[0]!];
  if (!g || g.type !== "group" || g.locked || !g.visible) return false;
  return ((s.childOrder[g.id] ?? []).length ?? 0) > 0;
}

function createComponentEligible(s: EditorState) {
  return inDesign(s) && canCreateComponentFromSelection(s.selectedIds, s.nodes);
}

function detachEligible(s: EditorState) {
  const id = s.selectedIds[0];
  if (!id) return false;
  return findInstanceRoot(s.nodes, id) != null;
}

function instanceRootId(s: EditorState): string | null {
  const id = s.selectedIds[0];
  if (!id) return null;
  return findInstanceRoot(s.nodes, id);
}

function typographyStyleFromSelectionEligible(s: EditorState) {
  if (!inDesign(s)) return false;
  return s.selectedIds.some((id) => {
    const n = s.nodes[id];
    return Boolean(n && !n.locked && n.visible && n.type === "text");
  });
}

function colorStyleFromSelectionEligible(s: EditorState) {
  if (!inDesign(s)) return false;
  const colorTypes = new Set(["frame", "rectangle", "ellipse", "path", "text"]);
  for (const id of s.selectedIds) {
    const n = s.nodes[id];
    if (!n || n.locked || !n.visible) continue;
    if (colorTypes.has(n.type)) return true;
  }
  return false;
}

function setToolSafe(s: EditorState, t: Tool) {
  s.setTool(t);
}

const tool = (id: string, title: string, subtitle: string, t: Tool, shortcut: string, extra?: Partial<CommandDefinition>): CommandDefinition => ({
  id,
  title,
  subtitle,
  category: "Tools",
  shortcut,
  keywords: [t, title.toLowerCase()],
  enabled: (s) => {
    if (t === "move" || t === "hand") return true;
    return inDesign(s);
  },
  run: (s) => {
    if (t === "comment") {
      s.setEditorMode("design");
      s.startPlacingComment();
      return;
    }
    if (t !== "move" && t !== "hand" && s.editorMode !== "design") {
      s.setEditorMode("design");
    }
    setToolSafe(s, t);
  },
  ...extra,
});

export const ALL_COMMANDS: CommandDefinition[] = [
  tool("tool-move", "Select Move tool", "Selection and transforms", "move", "V"),
  tool("tool-frame", "Select Frame tool", "Draw a new frame", "frame", "F"),
  tool("tool-rect", "Select Rectangle tool", "Draw rectangles", "rect", "R"),
  tool("tool-ellipse", "Select Ellipse tool", "Draw ellipses", "ellipse", ""),
  tool("tool-line", "Select Line tool", "Draw lines", "line", ""),
  tool("tool-pen", "Select Pen tool", "Vector paths", "pen", "P"),
  tool("tool-text", "Select Text tool", "Point text", "text", "T"),
  tool("tool-comment", "Select Comment tool", "Place a comment pin", "comment", ""),
  tool("tool-hand", "Select Hand tool", "Pan the canvas", "hand", "H"),

  {
    id: "copy-selection",
    title: "Copy",
    subtitle: "Copy selection to the editor clipboard",
    category: "Editing",
    shortcut: "⌘C",
    keywords: ["clipboard"],
    enabled: (s) => inDesign(s) && hasClippableTops(s),
    run: (s) => s.copySelection(),
  },
  {
    id: "cut-selection",
    title: "Cut",
    subtitle: "Copy to clipboard and remove selection",
    category: "Editing",
    shortcut: "⌘X",
    keywords: ["clipboard"],
    enabled: (s) => inDesign(s) && hasClippableTops(s),
    run: (s) => s.cutSelection(),
  },
  {
    id: "paste-selection",
    title: "Paste",
    subtitle: "Paste from the editor clipboard",
    category: "Editing",
    shortcut: "⌘V",
    keywords: ["clipboard"],
    enabled: canPasteFromClipboard,
    run: (s) => s.pasteSelection(),
  },
  {
    id: "paste-in-place",
    title: "Paste in place",
    subtitle: "Paste without nudging position",
    category: "Editing",
    shortcut: "⌘⇧V",
    keywords: ["clipboard"],
    enabled: canPasteFromClipboard,
    run: (s) => s.pasteSelection({ inPlace: true }),
  },
  {
    id: "select-all",
    title: "Select all",
    subtitle: "All visible, unlocked layers on the page",
    category: "Editing",
    shortcut: "⌘A",
    keywords: ["selection"],
    enabled: inDesign,
    run: (s) => s.selectAllEditable(),
  },
  {
    id: "toggle-lock-selection",
    title: "Lock / unlock selection",
    subtitle: "Toggle lock on every selected layer",
    category: "Editing",
    shortcut: "⌘L",
    keywords: ["lock"],
    enabled: (s) => inDesign(s) && hasSelection(s),
    run: (s) => s.toggleLockSelection(),
  },
  {
    id: "toggle-visible-selection",
    title: "Hide / show selection",
    subtitle: "Toggle visibility on every selected layer",
    category: "Editing",
    shortcut: "⌘⇧H",
    keywords: ["visibility", "hide"],
    enabled: (s) => inDesign(s) && hasSelection(s),
    run: (s) => s.toggleVisibleSelection(),
  },

  {
    id: "align-left",
    title: "Align left",
    subtitle: "Align selected layers to the left edge",
    category: "Arrange",
    shortcut: "",
    enabled: (s) => inDesign(s) && alignEligible(s),
    run: (s) => s.alignSelection("left"),
  },
  {
    id: "align-center-h",
    title: "Align horizontal centers",
    subtitle: "Center selection horizontally",
    category: "Arrange",
    shortcut: "",
    enabled: (s) => inDesign(s) && alignEligible(s),
    run: (s) => s.alignSelection("center-h"),
  },
  {
    id: "align-right",
    title: "Align right",
    subtitle: "Align selected layers to the right edge",
    category: "Arrange",
    shortcut: "",
    enabled: (s) => inDesign(s) && alignEligible(s),
    run: (s) => s.alignSelection("right"),
  },
  {
    id: "align-top",
    title: "Align top",
    subtitle: "Align selected layers to the top edge",
    category: "Arrange",
    shortcut: "",
    enabled: (s) => inDesign(s) && alignEligible(s),
    run: (s) => s.alignSelection("top"),
  },
  {
    id: "align-center-v",
    title: "Align vertical centers",
    subtitle: "Center selection vertically",
    category: "Arrange",
    shortcut: "",
    enabled: (s) => inDesign(s) && alignEligible(s),
    run: (s) => s.alignSelection("center-v"),
  },
  {
    id: "align-bottom",
    title: "Align bottom",
    subtitle: "Align selected layers to the bottom edge",
    category: "Arrange",
    shortcut: "",
    enabled: (s) => inDesign(s) && alignEligible(s),
    run: (s) => s.alignSelection("bottom"),
  },
  {
    id: "distribute-horizontal",
    title: "Distribute horizontal spacing",
    subtitle: "Even spacing between three or more layers",
    category: "Arrange",
    shortcut: "",
    keywords: ["distribute"],
    enabled: (s) => inDesign(s) && distributeEligible(s),
    run: (s) => s.distributeSelection("horizontal"),
  },
  {
    id: "distribute-vertical",
    title: "Distribute vertical spacing",
    subtitle: "Even vertical spacing between three or more layers",
    category: "Arrange",
    shortcut: "",
    keywords: ["distribute"],
    enabled: (s) => inDesign(s) && distributeEligible(s),
    run: (s) => s.distributeSelection("vertical"),
  },

  {
    id: "duplicate-selection",
    title: "Duplicate selection",
    subtitle: "Copy selected layers",
    category: "Actions",
    shortcut: "⌘D",
    keywords: ["copy", "clone"],
    enabled: hasClippableTops,
    run: (s) => s.duplicateSelection(),
  },
  {
    id: "delete-selection",
    title: "Delete selection",
    subtitle: "Remove selected layers",
    category: "Actions",
    shortcut: "⌫",
    keywords: ["remove", "erase"],
    enabled: (s) => s.selectedIds.length > 0,
    run: (s) => s.deleteSelection(),
  },
  {
    id: "group-selection",
    title: "Group selection",
    subtitle: "Wrap selection in a group",
    category: "Actions",
    shortcut: "⌘G",
    enabled: (s) => inDesign(s) && groupEligible(s),
    run: (s) => s.groupSelection(),
  },
  {
    id: "ungroup-selection",
    title: "Ungroup selection",
    subtitle: "Explode group to layers",
    category: "Actions",
    shortcut: "⌘⇧G",
    enabled: (s) => inDesign(s) && ungroupEligible(s),
    run: (s) => s.ungroupSelection(),
  },
  {
    id: "add-auto-layout",
    title: "Add auto layout",
    subtitle: "Wrap selection in an auto-layout frame (Figma ⇧A)",
    category: "Actions",
    shortcut: "⇧A",
    keywords: ["frame", "flex", "stack", "layout"],
    enabled: (s) => inDesign(s) && canAddAutoLayoutToSelection(s.selectedIds, s.nodes),
    run: (s) => s.addAutoLayoutToSelection(),
  },
  {
    id: "bring-forward",
    title: "Bring forward",
    subtitle: "Move up one level",
    category: "Actions",
    shortcut: "⌘]",
    enabled: (s) => inDesign(s) && s.selectedIds.length > 0,
    run: (s) => s.bringForward(),
  },
  {
    id: "send-backward",
    title: "Send backward",
    subtitle: "Move down one level",
    category: "Actions",
    shortcut: "⌘[",
    enabled: (s) => inDesign(s) && s.selectedIds.length > 0,
    run: (s) => s.sendBackward(),
  },
  {
    id: "bring-to-front",
    title: "Bring to front",
    subtitle: "Top of stack",
    category: "Actions",
    shortcut: "⌘⇧]",
    enabled: (s) => inDesign(s) && s.selectedIds.length > 0,
    run: (s) => s.bringToFront(),
  },
  {
    id: "send-to-back",
    title: "Send to back",
    subtitle: "Bottom of stack",
    category: "Actions",
    shortcut: "⌘⇧[",
    enabled: (s) => inDesign(s) && s.selectedIds.length > 0,
    run: (s) => s.sendToBack(),
  },
  {
    id: "create-component",
    title: "Create component",
    subtitle: "From selection — frames, groups, or shapes",
    category: "Actions",
    shortcut: "⌘⌥K",
    enabled: createComponentEligible,
    run: (s) => s.createComponentFromSelection(),
  },
  {
    id: "detach-instance",
    title: "Detach instance",
    subtitle: "Break link to master component",
    category: "Actions",
    shortcut: "",
    enabled: (s) => inDesign(s) && detachEligible(s),
    run: (s) => {
      const root = instanceRootId(s);
      if (root) s.detachInstance(root);
    },
  },
  {
    id: "create-color-style",
    title: "Create color style",
    subtitle: "Capture fill or text color from the selection",
    category: "Actions",
    shortcut: "",
    keywords: ["design token", "swatch", "paint"],
    enabled: colorStyleFromSelectionEligible,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.createColorTokenFromSelection();
    },
  },
  {
    id: "create-typography-style",
    title: "Create typography style",
    subtitle: "Capture font settings from selected text",
    category: "Actions",
    shortcut: "",
    keywords: ["design token", "font", "text style"],
    enabled: typographyStyleFromSelectionEligible,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.createTypographyTokenFromSelection();
    },
  },
  {
    id: "toggle-ui-chrome",
    title: "Show / hide UI",
    subtitle: "Toggle side panels, toolbar, and footer",
    category: "View",
    shortcut: "⌘.",
    keywords: ["panels", "sidebar", "chrome", "ui", "zen", "interface"],
    enabled: () => true,
    run: (s) => s.toggleUiChrome(),
  },
  {
    id: "toggle-grid",
    title: "Toggle layout grid",
    subtitle: "Canvas dot grid",
    category: "View",
    shortcut: "",
    enabled: () => true,
    run: (s) => s.toggleGrid(),
  },
  {
    id: "toggle-presence",
    title: "Toggle mock presence",
    subtitle: "Simulated collaborators",
    category: "View",
    shortcut: "",
    enabled: () => true,
    run: (s) => s.togglePresence(),
  },
  {
    id: "toggle-comments-panel",
    title: "Toggle comments",
    subtitle: "Comments panel in the right sidebar",
    category: "View",
    shortcut: "",
    keywords: ["comments", "feedback", "toggle"],
    enabled: (s) => s.editorMode === "design",
    run: (s) => s.toggleCommentsPanel(),
  },
  {
    id: "open-styles-panel",
    title: "Open design system library",
    subtitle: "Shared colors, typography, spacing, and effects",
    category: "View",
    shortcut: "",
    keywords: ["design tokens", "library", "swatches"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      if (s.editorMode !== "design") s.setEditorMode("design");
      s.setLeftTab("styles");
    },
  },
  {
    id: "open-components-panel",
    title: "Open components panel",
    subtitle: "Search and place reusable components",
    category: "View",
    shortcut: "⌥2",
    keywords: ["components", "comp", "library", "search", "instances", "master"],
    enabled: (s) => s.editorMode === "design",
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.setLeftTab("components");
    },
  },
  {
    id: "mode-design",
    title: "Enter design mode",
    subtitle: "Canvas editing",
    category: "Modes",
    shortcut: "",
    enabled: (s) => s.editorMode !== "design",
    run: (s) => s.setEditorMode("design"),
  },
  {
    id: "mode-prototype",
    title: "Enter prototype mode",
    subtitle: "Flows and hotspots",
    category: "Modes",
    shortcut: "",
    enabled: (s) => s.editorMode !== "prototype",
    run: (s) => s.setEditorMode("prototype"),
  },
  {
    id: "mode-inspect",
    title: "Enter inspect mode",
    subtitle: "Measure and export",
    category: "Modes",
    shortcut: "",
    enabled: (s) => s.editorMode !== "inspect",
    run: (s) => s.setEditorMode("inspect"),
  },
  {
    id: "show-shortcuts",
    title: "Show keyboard shortcuts",
    subtitle: "Reference overlay",
    category: "View",
    shortcut: "⌘/",
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.closeShareModal();
      s.closeWorkspacePicker();
      s.closeTeamInviteModal();
      s.setShortcutOverlayOpen(true);
    },
  },
  {
    id: "open-help-demo-checklist",
    title: "Help",
    subtitle: "Open the demo checklist in a new tab",
    category: "View",
    shortcut: "",
    keywords: ["help", "guide", "demo", "checklist", "documentation"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.openHelpDemoChecklist();
    },
  },
  {
    id: "ai-generate-design",
    title: "Open AI generator",
    subtitle: "Mock prompt-to-layout (no API)",
    category: "View",
    shortcut: "",
    keywords: ["ai", "gpt", "layout", "generate", "prompt"],
    enabled: () => true,
    run: (s) => s.openAIModal("editor"),
  },
  {
    id: "plugins-open-marketplace",
    title: "Open plugins",
    subtitle: "Browse and install mock extensions",
    category: "Plugins",
    shortcut: "",
    keywords: ["marketplace", "extensions", "add-ons"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.openPluginMarketplace();
    },
  },
  {
    id: "plugins-run-contrast",
    title: "Run Contrast Checker",
    subtitle: "Mock WCAG-style estimate for selection",
    category: "Plugins",
    shortcut: "",
    keywords: ["a11y", "wcag", "color"],
    enabled: (s) => s.installedPluginIds.includes("contrast-checker"),
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.runPlugin("contrast-checker");
    },
  },
  {
    id: "plugins-run-lorem",
    title: "Run Lorem Ipsum",
    subtitle: "Fill selected text layers",
    category: "Plugins",
    shortcut: "",
    keywords: ["text", "placeholder", "copy"],
    enabled: (s) => s.installedPluginIds.includes("lorem-ipsum"),
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.runPlugin("lorem-ipsum");
    },
  },
  {
    id: "plugins-run-tokens",
    title: "Run Token Extractor",
    subtitle: "Summarize document tokens",
    category: "Plugins",
    shortcut: "",
    keywords: ["design tokens", "colors", "typography"],
    enabled: (s) => s.installedPluginIds.includes("token-extractor"),
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.runPlugin("token-extractor");
    },
  },
  {
    id: "add-page",
    title: "New page",
    subtitle: "Add a blank page to this file",
    category: "Files",
    shortcut: "⌘⇧N",
    keywords: ["page", "tab"],
    enabled: () => true,
    run: (s) => s.addPage(),
  },
  {
    id: "duplicate-active-page",
    title: "Duplicate page",
    subtitle: "Duplicate the current page",
    category: "Files",
    shortcut: "",
    keywords: ["page", "copy"],
    enabled: () => true,
    run: (s) => s.duplicatePage(),
  },
  {
    id: "delete-active-page",
    title: "Delete page",
    subtitle: "Remove the current page",
    category: "Files",
    shortcut: "",
    keywords: ["page", "remove"],
    enabled: (s) => s.pageOrder.length > 1,
    run: (s) => s.deletePage(s.activePageId),
  },
  {
    id: "previous-page",
    title: "Previous page",
    subtitle: "Switch to the previous page",
    category: "Files",
    shortcut: "⌘⌥↑",
    keywords: ["page", "tab", "back"],
    enabled: (s) => s.pageOrder.indexOf(s.activePageId) > 0,
    run: (s) => s.cycleActivePage(-1),
  },
  {
    id: "next-page",
    title: "Next page",
    subtitle: "Switch to the next page",
    category: "Files",
    shortcut: "⌘⌥↓",
    keywords: ["page", "tab", "forward"],
    enabled: (s) => {
      const idx = s.pageOrder.indexOf(s.activePageId);
      return idx >= 0 && idx < s.pageOrder.length - 1;
    },
    run: (s) => s.cycleActivePage(1),
  },
  {
    id: "export-document",
    title: "Export document",
    subtitle: "Download .paytmcraft.json",
    category: "Files",
    shortcut: "",
    enabled: () => true,
    run: (s) => s.exportDocument(),
  },
  {
    id: "save-locally",
    title: "Save document",
    subtitle: "Browser storage; API mode also updates API when file is API-backed",
    category: "Files",
    shortcut: "",
    enabled: () => true,
    run: (s) => s.saveToLocal(),
  },
  {
    id: "open-version-history",
    title: "Open version history",
    subtitle: "Named snapshots and restore (mock API)",
    category: "Files",
    shortcut: "",
    keywords: ["versions", "history", "snapshot"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.openVersionHistory();
    },
  },
  {
    id: "reset-document",
    title: "Reset document",
    subtitle: "New file from template (confirm)",
    category: "Files",
    shortcut: "",
    enabled: () => true,
    run: (s) => s.resetDocument(),
  },
  {
    id: "workspace-open-share",
    title: "Open share settings",
    subtitle: "Mock share dialog for this file",
    category: "Workspace",
    shortcut: "",
    keywords: ["share", "link", "collaborate", "permissions"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.openShareModal();
    },
  },
  {
    id: "workspace-switch",
    title: "Switch workspace",
    subtitle: "Local mock workspaces (localStorage)",
    category: "Workspace",
    shortcut: "",
    keywords: ["space", "personal", "product", "design"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.openWorkspacePicker();
    },
  },
  {
    id: "workspace-invite-member",
    title: "Invite team member",
    subtitle: "Pending invite stored in this browser",
    category: "Workspace",
    shortcut: "",
    keywords: ["email", "invite", "collaborator"],
    enabled: () => true,
    run: (s) => {
      s.setCommandMenuOpen(false);
      s.openTeamInviteModal();
    },
  },
];

export const COMMAND_BY_ID: Record<string, CommandDefinition> = Object.fromEntries(
  ALL_COMMANDS.map((c) => [c.id, c]),
);

const CATEGORY_ORDER: CommandCategory[] = [
  "Tools",
  "Editing",
  "Arrange",
  "Actions",
  "Modes",
  "View",
  "Plugins",
  "Workspace",
  "Files",
];

export function searchCommands(query: string, state: EditorState): CommandDefinition[] {
  const q = query.trim().toLowerCase();
  const enabled = ALL_COMMANDS.filter((c) => c.enabled(state));
  if (!q) return enabled;
  return enabled.filter((c) => {
    if (c.title.toLowerCase().includes(q)) return true;
    if (c.subtitle.toLowerCase().includes(q)) return true;
    if (c.category.toLowerCase().includes(q)) return true;
    if (c.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
    return false;
  });
}

export function groupCommandsByCategory(commands: CommandDefinition[]): Map<CommandCategory, CommandDefinition[]> {
  const map = new Map<CommandCategory, CommandDefinition[]>();
  for (const cat of CATEGORY_ORDER) map.set(cat, []);
  for (const c of commands) {
    const list = map.get(c.category) ?? [];
    list.push(c);
    map.set(c.category, list);
  }
  return map;
}

export function formatShortcutLabel(shortcut: string): string {
  if (!shortcut) return "";
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl+";
  return shortcut.replace(/⌘/g, mod);
}
