"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { inspectorFieldIconButtonClass } from "@/lib/inspectorIconStyles";
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
          inspectorFieldIconButtonClass,
          active
            ? "border-app-panel-edge bg-app-inset text-app-fg hover:bg-app-inset"
            : undefined,
        )}
      >
        {children}
      </button>
    </EditorHintWrap>
  );
}
