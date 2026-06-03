import { cn } from "@/lib/utils";

/** Shared inspector / property field chrome (theme-aware via CSS variables). */
export const appFieldClass = cn(
  "h-6 min-h-[24px] w-full rounded border border-app-border bg-app-field px-1.5 py-0",
  "text-[12px] leading-4 text-app-field-fg placeholder:text-app-subtle",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:opacity-45",
);
