import { cn } from "@/lib/utils";

/** Crisp 16px inspector icons (avoids blurry 14px / h-3.5 sizing). */
export const inspectorIconClass = "inspector-icon h-4 w-4 shrink-0";

/** Lucide stroke at 16px — 2px reads sharper than 1.75. */
export const inspectorIconStroke = 2;

export const inspectorHeaderActionBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40";

export const inspectorRowActionBtnClass =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40";

/** Icon buttons inside grouped transform / inset tool strips (no per-button rounding). */
export const inspectorTransformActionBtnClass =
  "inspector-icon-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40";

export const inspectorFieldIconSlotClass =
  "flex h-7 w-8 shrink-0 items-center justify-center border-r border-app-border text-app-muted";

export function inspectorLucideProps(className?: string) {
  return {
    className: cn(inspectorIconClass, className),
    strokeWidth: inspectorIconStroke,
  } as const;
}

export function inspectorInlineSvgClass(className?: string) {
  return cn(inspectorIconClass, className);
}
