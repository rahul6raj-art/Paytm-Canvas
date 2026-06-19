"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { appFieldRadius, inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

/** Icon button beside W/H fields (aspect lock, fit to content, etc.). */
export function DimensionFieldsIconButton({
  title,
  ariaLabel,
  pressed,
  active,
  disabled,
  onClick,
  buttonRef,
  children,
}: {
  title: string;
  ariaLabel: string;
  pressed?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <EditorHintWrap title={title} disabled={disabled}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          "flex w-7 shrink-0 items-center justify-center border border-app-border bg-app-panel transition-colors disabled:opacity-40",
          inspectorControlHeightClass,
          appFieldRadius,
          active
            ? "border-app-panel-edge bg-app-inset text-app-fg hover:bg-app-inset"
            : "text-app-muted hover:bg-app-hover hover:text-app-fg",
        )}
      >
        {children}
      </button>
    </EditorHintWrap>
  );
}
