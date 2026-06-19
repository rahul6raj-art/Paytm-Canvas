"use client";

import { cn } from "@/lib/utils";
import { parseEditorHintTitle } from "@/lib/editorHoverHint";
import { EditorHoverHint, type EditorHoverHintSide } from "./EditorHoverHint";
import type { ButtonHTMLAttributes } from "react";

export function ToolButton({
  active,
  className,
  hintLabel,
  hintShortcut,
  hintSide = "top",
  title,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  hintLabel?: string;
  hintShortcut?: string;
  hintSide?: EditorHoverHintSide;
}) {
  const parsed = title && !hintLabel ? parseEditorHintTitle(title) : null;
  const label = hintLabel ?? parsed?.label;
  const shortcut = hintShortcut ?? parsed?.shortcut;

  const button = (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border text-app-muted transition-colors",
        "border-transparent hover:border-app-border hover:bg-app-hover hover:text-app-fg",
        active &&
          "border-transparent bg-app-fg text-app-bg shadow-sm hover:border-transparent hover:bg-app-fg hover:text-app-bg",
        className,
      )}
      {...props}
    />
  );

  if (!label) return button;

  return (
    <EditorHoverHint label={label} shortcut={shortcut} side={hintSide} disabled={disabled}>
      {button}
    </EditorHoverHint>
  );
}
