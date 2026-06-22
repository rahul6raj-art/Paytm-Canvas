import { cn } from "@/lib/utils";

/** Standard inspector control height (scales up inside `[data-editor-shell]`). */
export const inspectorControlHeightClass =
  "h-[var(--inspector-control-height)] min-h-[var(--inspector-control-height)]";

/** Taller track for fill/stroke type segmented controls (Solid, Gradient, …). */
export const inspectorSegmentedHeightClass =
  "h-[var(--inspector-segmented-height)] min-h-[var(--inspector-segmented-height)]";

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
  "min-w-0 w-full flex-1 rounded-none border-0 bg-transparent px-2.5 py-0 shadow-none",
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
  "border border-app-border bg-app-inset px-2.5 py-0",
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

/** Square inspector icon control — width matches {@link inspectorControlHeightClass}. */
export const inspectorIconButtonSizeClass = cn(
  inspectorControlHeightClass,
  "w-[var(--inspector-control-height)] min-w-[var(--inspector-control-height)] max-w-[var(--inspector-control-height)] shrink-0",
);

/** Shared flex centering for icon-only inspector buttons. */
export const inspectorIconButtonBaseClass = cn(
  inspectorIconButtonSizeClass,
  "inline-flex items-center justify-center p-0 leading-none",
);

/** Compact square icon control for dense rows. */
export const inspectorIconButtonSizeCompactClass = cn(
  "h-[var(--inspector-control-height-compact)] min-h-[var(--inspector-control-height-compact)]",
  "w-[var(--inspector-control-height-compact)] min-w-[var(--inspector-control-height-compact)] max-w-[var(--inspector-control-height-compact)] shrink-0",
);

export const inspectorIconButtonBaseCompactClass = cn(
  inspectorIconButtonSizeCompactClass,
  "inline-flex items-center justify-center p-0 leading-none",
);

export const inspectorOpacitySegmentClass = cn(
  appFieldShellClass,
  "w-auto min-w-[4.75rem] shrink-0 grow-0 overflow-visible rounded-l-none",
);

export const inspectorOpacitySegmentCompactClass = cn(
  appFieldShellClassCompact,
  "w-auto min-w-[4.75rem] shrink-0 grow-0 overflow-visible rounded-l-none",
);

/** Opacity percent input — never use {@link appFieldInnerClass}; its flex-1 shrinks "100". */
export const inspectorOpacityInputClass = cn(
  inspectorControlHeightClass,
  "w-[2.5rem] shrink-0 grow-0 basis-[2.5rem] rounded-none border-0 bg-transparent px-1 py-0 shadow-none",
  "text-right font-mono tabular-nums text-ui text-app-field-fg",
  "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
);

export const inspectorOpacityInputCompactClass = cn(
  "h-[var(--inspector-control-height-compact)] min-h-[var(--inspector-control-height-compact)]",
  "w-[2.5rem] shrink-0 grow-0 basis-[2.5rem] rounded-none border-0 bg-transparent px-1 py-0 shadow-none",
  "text-right font-mono tabular-nums text-ui text-app-field-fg",
  "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
);

export const inspectorOpacitySuffixClass = "shrink-0 grow-0 pl-0.5 pr-2 text-ui text-app-subtle";
