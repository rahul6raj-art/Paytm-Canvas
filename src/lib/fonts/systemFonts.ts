import type { FontFamilyOption } from "./fontCatalog";

function sys(id: string, label: string, value: string, primary?: string): FontFamilyOption {
  return { id, label, value, source: "system", primary: primary ?? label };
}

/** Cross-platform system and generic stacks (no network load). */
export const SYSTEM_FONT_OPTIONS: FontFamilyOption[] = [
  sys("sys-ui", "System UI", "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", "system-ui"),
  sys("inter-var", "Inter (app)", "var(--font-inter), Inter, system-ui, sans-serif", "Inter"),
  sys("arial", "Arial", "Arial, Helvetica, sans-serif"),
  sys("helvetica", "Helvetica Neue", '"Helvetica Neue", Helvetica, Arial, sans-serif', "Helvetica Neue"),
  sys("segoe", "Segoe UI", '"Segoe UI", SegoeUI, system-ui, sans-serif', "Segoe UI"),
  sys("sf-pro", "SF Pro", '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif', "SF Pro Text"),
  sys("roboto-sys", "Roboto (Android)", "Roboto, system-ui, sans-serif", "Roboto"),
  sys("verdana", "Verdana", "Verdana, Geneva, sans-serif"),
  sys("tahoma", "Tahoma", "Tahoma, Geneva, sans-serif"),
  sys("trebuchet", "Trebuchet MS", '"Trebuchet MS", Helvetica, sans-serif', "Trebuchet MS"),
  sys("georgia", "Georgia", "Georgia, serif"),
  sys("times", "Times New Roman", '"Times New Roman", Times, serif', "Times New Roman"),
  sys("palatino", "Palatino", '"Palatino Linotype", Palatino, serif', "Palatino Linotype"),
  sys("garamond", "Garamond", 'Garamond, "Times New Roman", serif'),
  sys("baskerville", "Baskerville", 'Baskerville, "Times New Roman", serif'),
  sys("courier", "Courier New", '"Courier New", Courier, monospace', "Courier New"),
  sys("monaco", "Monaco / Menlo", 'Menlo, Monaco, Consolas, "Courier New", monospace', "Menlo"),
  sys("consolas", "Consolas", 'Consolas, "Liberation Mono", monospace'),
  sys("sf-mono", "SF Mono", '"SF Mono", Menlo, Monaco, Consolas, monospace', "SF Mono"),
  sys("mono-ui", "System Monospace", "ui-monospace, SFMono-Regular, Menlo, monospace", "ui-monospace"),
  sys("impact", "Impact", "Impact, Haettenschweiler, sans-serif"),
  sys("comic", "Comic Sans MS", '"Comic Sans MS", cursive', "Comic Sans MS"),
  sys("brush", "Brush Script MT", '"Brush Script MT", cursive', "Brush Script MT"),
  sys("sans-generic", "Sans-serif (generic)", "sans-serif"),
  sys("serif-generic", "Serif (generic)", "serif"),
  sys("mono-generic", "Monospace (generic)", "monospace"),
];
