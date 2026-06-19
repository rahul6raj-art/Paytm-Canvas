import { cn } from "@/lib/utils";

/** Standard inspector control height (scales up inside `[data-editor-shell]`). */
export const inspectorControlHeightClass =
  "h-[var(--inspector-control-height)] min-h-[var(--inspector-control-height)]";

/** Shared horizontal gap between inspector controls in a row (X/Y, W/H, rotation, etc.). */
export const inspectorRowGapClass = "gap-2";

/** Two-column inspector field grid (position X/Y, effect offsets, etc.). */
export const inspectorTwoColGridClass = "grid grid-cols-2 gap-2";

/** Shared corner radius for inspector inputs, selects, and inset field shells. */
export const appFieldRadius = "rounded-md";

/** Inset field shell (rotation, position, property inputs). */
export const appFieldShellClass = cn(
  "flex min-w-0 items-center overflow-hidden border border-app-border bg-app-inset",
  inspectorControlHeightClass,
  appFieldRadius,
);

/** Borderless input nested inside {@link appFieldShellClass}. */
export const appFieldInnerClass = cn(
  inspectorControlHeightClass,
  "min-w-0 w-full flex-1 rounded-none border-0 bg-transparent px-2 py-0 shadow-none",
  "text-ui text-app-field-fg placeholder:text-app-subtle",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-45",
);

/** Compact inset shell for dense rows (effects, stroke). */
export const appFieldShellClassCompact = cn(
  "flex min-w-0 items-center overflow-hidden border border-app-border bg-app-inset",
  "h-[var(--inspector-control-height-compact)] min-h-[var(--inspector-control-height-compact)]",
  appFieldRadius,
);

/** Borderless control nested inside {@link appFieldShellClassCompact}. */
export const appFieldInnerClassCompact = cn(
  "h-full w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-1.5 py-0 shadow-none",
  "text-ui text-app-field-fg placeholder:text-app-subtle",
  "focus-visible:outline-none focus-visible:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-40",
);

/** Shared inspector / property field chrome (theme-aware via CSS variables). */
export const appFieldClass = cn(
  inspectorControlHeightClass,
  "w-full",
  appFieldRadius,
  "border border-app-border bg-app-inset px-2 py-0",
  "text-ui text-app-field-fg placeholder:text-app-subtle",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:opacity-45",
);

/** Compact variant for dense inspector rows (stroke, effects, etc.). */
export const appFieldClassCompact = cn(
  "h-[var(--inspector-control-height-compact)] min-h-[var(--inspector-control-height-compact)] w-full",
  appFieldRadius,
  "border border-app-border bg-app-inset px-1.5 py-0",
  "text-ui text-app-field-fg placeholder:text-app-subtle",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:opacity-40",
);
