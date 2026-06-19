/** Figma-style auto-resize labels (serialization). */
export type AutoResizeMode = "width-height" | "height" | "none";

export type TextResizeModeLiteral = "auto-width" | "auto-height" | "fixed";

export function textResizeModeToAutoResize(mode: TextResizeModeLiteral): AutoResizeMode {
  switch (mode) {
    case "auto-width":
      return "width-height";
    case "auto-height":
      return "height";
    case "fixed":
      return "none";
  }
}

export function autoResizeToTextResizeMode(value: unknown): TextResizeModeLiteral {
  if (value === "width-height") return "auto-width";
  if (value === "height") return "auto-height";
  if (value === "none" || value === "fixed") return "fixed";
  return "auto-width";
}
