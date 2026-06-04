/** Figma-aligned shortcut reference for the shortcuts overlay (⌘ = Ctrl on Windows). */

export type ShortcutRow = { keys: string; label: string; note?: string };

export const SHORTCUT_TOOLS: ShortcutRow[] = [
  { keys: "V", label: "Move" },
  { keys: "F", label: "Frame" },
  { keys: "⇧S", label: "Section", note: "Frame tool" },
  { keys: "R", label: "Rectangle" },
  { keys: "O", label: "Ellipse" },
  { keys: "L", label: "Line" },
  { keys: "⇧L", label: "Arrow" },
  { keys: "P", label: "Pen" },
  { keys: "⇧P", label: "Pencil / freehand" },
  { keys: "T", label: "Text" },
  { keys: "H", label: "Hand" },
  { keys: "Space", label: "Hand (hold)" },
  { keys: "C", label: "Comment" },
];

export const SHORTCUT_OBJECT: ShortcutRow[] = [
  { keys: "⌘G", label: "Group" },
  { keys: "⌘⇧G", label: "Ungroup", note: "Or toggle layout grid when nothing to ungroup" },
  { keys: "⌘⌥G", label: "Frame selection" },
  { keys: "⇧A", label: "Auto layout" },
  { keys: "⌘⌥K", label: "Create component" },
  { keys: "⌘⌥B", label: "Detach instance" },
  { keys: "⇧I", label: "Resources (assets panel)" },
];

export const SHORTCUT_ALIGN: ShortcutRow[] = [
  { keys: "⌥A", label: "Align left" },
  { keys: "⌥D", label: "Align right" },
  { keys: "⌥W", label: "Align top" },
  { keys: "⌥S", label: "Align bottom" },
  { keys: "⌥H", label: "Align horizontal centers" },
  { keys: "⌥V", label: "Align vertical centers" },
];

export const SHORTCUT_ZOOM: ShortcutRow[] = [
  { keys: "⌘+", label: "Zoom in" },
  { keys: "⌘−", label: "Zoom out" },
  { keys: "⌘0", label: "Zoom to 100%" },
  { keys: "⇧1", label: "Zoom to fit all" },
  { keys: "⇧2", label: "Zoom to fit selection" },
  { keys: "N", label: "Next frame" },
  { keys: "⇧N", label: "Previous frame" },
  { keys: "⇧R", label: "Show / hide rulers" },
];

export const SHORTCUT_VIEW: ShortcutRow[] = [
  { keys: "⌘\\", label: "Toggle UI chrome", note: "Also ⌘." },
  { keys: "⇧\\", label: "Toggle UI chrome" },
  { keys: "⌘⇧G", label: "Toggle layout grid" },
  { keys: "⌘K", label: "Quick actions (command menu)" },
  { keys: "⌘/", label: "Quick actions (command menu)" },
  { keys: "⌘⇧?", label: "Keyboard shortcuts list" },
];

export const SHORTCUT_EDITING: ShortcutRow[] = [
  { keys: "⌘Z", label: "Undo" },
  { keys: "⌘⇧Z", label: "Redo" },
  { keys: "⌘C", label: "Copy" },
  { keys: "⌘X", label: "Cut" },
  { keys: "⌘V", label: "Paste" },
  { keys: "⌘⇧V", label: "Paste in place" },
  { keys: "⌘D", label: "Duplicate" },
  { keys: "⌫", label: "Delete selection" },
  { keys: "⌘⇧E", label: "Export design code" },
  { keys: "⌘⇧K", label: "Place image" },
];

export const SHORTCUT_CANVAS: ShortcutRow[] = [
  { keys: "Esc", label: "Clear selection / cancel tool" },
  { keys: "Enter", label: "Finish path / edit text or vector" },
];
