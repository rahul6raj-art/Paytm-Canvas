import { cn } from "@/lib/utils";
import {
  inspectorIconButtonBaseClass,
  inspectorIconButtonBaseCompactClass,
} from "@/lib/appFieldStyles";

/** Crisp 16px inspector icons (avoids blurry 14px / h-3.5 sizing). */
export const inspectorIconClass = "inspector-icon h-4 w-4 shrink-0";

/** Lucide stroke at 16px — 2px reads sharper than 1.75. */
export const inspectorIconStroke = 2;

const inspectorIconBtnInteractive =
  "text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40";

export const inspectorHeaderActionBtnClass = cn(
  inspectorIconButtonBaseClass,
  "inspector-icon-btn rounded",
  inspectorIconBtnInteractive,
);

/** Icon + chevron header controls (create component, boolean, etc.). */
export const inspectorHeaderDropdownBtnClass = cn(
  inspectorHeaderActionBtnClass,
  "max-w-none h-8 min-h-8 w-auto min-w-9 shrink-0 gap-0.5 px-1.5",
);

export const inspectorHeaderDropdownAnchorClass = "inline-flex shrink-0";

export const inspectorRowActionBtnClass = cn(
  inspectorIconButtonBaseClass,
  "inspector-icon-btn rounded",
  inspectorIconBtnInteractive,
);

/** Icon buttons inside grouped transform / inset tool strips (no per-button rounding). */
export const inspectorTransformActionBtnClass = cn(
  inspectorIconButtonBaseClass,
  "inspector-icon-btn rounded-none",
  inspectorIconBtnInteractive,
);

/** Leading label slot inside property number fields (W, H, X, Y, etc.). */
export const inspectorFieldIconSlotClass = cn(
  inspectorIconButtonBaseClass,
  "inspector-icon-btn rounded-none border-r border-app-border bg-transparent text-app-muted",
);

/** Bordered icon button aligned to property field rows (aspect lock, stroke sides, etc.). */
export const inspectorFieldIconButtonClass = cn(
  inspectorIconButtonBaseClass,
  "inspector-icon-btn rounded-md border border-app-border bg-app-panel",
  inspectorIconBtnInteractive,
);

export const inspectorFieldIconButtonCompactClass = cn(
  inspectorIconButtonBaseCompactClass,
  "inspector-icon-btn rounded-md border border-app-border bg-app-panel",
  inspectorIconBtnInteractive,
);

/** Leading swatch / icon slot in compact color rows. */
export const inspectorFieldIconSlotCompactClass = cn(
  inspectorIconButtonBaseCompactClass,
  "inspector-icon-btn rounded-none border-r border-app-border bg-transparent text-app-muted",
);

export function inspectorLucideProps(className?: string) {
  return {
    className: cn(inspectorIconClass, className),
    strokeWidth: inspectorIconStroke,
  } as const;
}

export function inspectorInlineSvgClass(className?: string) {
  return cn(inspectorIconClass, className);
}
