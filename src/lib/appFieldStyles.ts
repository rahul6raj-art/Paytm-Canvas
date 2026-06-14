import { cn } from "@/lib/utils";

/** Standard 28px height for right-panel inputs, segmented controls, and icon tool groups. */
export const inspectorControlHeightClass = "h-7 min-h-7";

/** Shared corner radius for inspector inputs, selects, and inset field shells. */
export const appFieldRadius = "rounded-md";

/** Shared inspector / property field chrome (theme-aware via CSS variables). */
export const appFieldClass = cn(
  inspectorControlHeightClass,
  "w-full",
  appFieldRadius,
  "border border-app-border bg-app-field px-2 py-0",
  "text-ui text-app-field-fg placeholder:text-app-subtle",
  "shadow-[inset_0_1px_0_0_hsl(var(--app-inset-highlight)/var(--app-inset-highlight-opacity))]",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:opacity-45",
);

/** Compact h-6 variant for dense inspector rows (stroke, effects, etc.). */
export const appFieldClassCompact = cn(
  "h-6 min-h-[24px] w-full",
  appFieldRadius,
  "border border-app-border bg-app-field px-1.5 py-0",
  "text-ui text-app-field-fg placeholder:text-app-subtle",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:opacity-40",
);
