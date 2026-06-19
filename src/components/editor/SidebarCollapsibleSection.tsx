"use client";

import {
  Children,
  useCallback,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarCollapsibleSection({
  title,
  leading,
  open: controlledOpen,
  defaultOpen = true,
  variant = "flat",
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  children,
  footer,
  hideFooterWhenCollapsed = false,
  compactWhenCollapsed = false,
  fillAvailable = true,
  footerFill = false,
  onOpenChange,
  style,
  sectionRef,
}: {
  title: string;
  leading?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  /** `card` — rounded panel with border; `flat` — full-bleed panel row. */
  variant?: "flat" | "card";
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  children?: ReactNode;
  /** Shown below content; stays visible when collapsed unless `hideFooterWhenCollapsed`. */
  footer?: ReactNode;
  /** Hide `footer` when the section is collapsed (header-only compact row). */
  hideFooterWhenCollapsed?: boolean;
  /** When collapsed, shrink to header height instead of filling remaining sidebar space. */
  compactWhenCollapsed?: boolean;
  /** When false, section height follows content instead of stretching in a fixed split pane. */
  fillAvailable?: boolean;
  /** When true, footer expands to fill space below content (e.g. bottom-anchored composer). */
  footerFill?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: CSSProperties;
  sectionRef?: Ref<HTMLElement>;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean | ((value: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(open) : next;
      if (controlledOpen === undefined) setUncontrolledOpen(resolved);
      onOpenChange?.(resolved);
    },
    [controlledOpen, onOpenChange, open],
  );
  const isCard = variant === "card";
  const hasContent = Children.toArray(children).length > 0;
  const showFooter = Boolean(footer) && !(hideFooterWhenCollapsed && !open);
  const isCompact = compactWhenCollapsed && !open;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        isCard
          ? "editor-sidebar-section"
          : "bg-chrome-panel",
        className,
        isCompact && "mt-auto shrink-0 !flex-none",
      )}
      style={style}
    >
      <button
        type="button"
        aria-expanded={open}
        className={cn(
          "flex h-10 shrink-0 items-center justify-between px-3.5 font-medium text-app-fg transition-colors hover:bg-app-hover",
          isCard ? "text-base" : "text-ui",
          open && "border-b border-app-panel-edge",
          !open && showFooter && "border-b border-app-panel-edge",
          isCard && (open ? "rounded-t-2xl" : showFooter ? "rounded-t-2xl" : "rounded-2xl"),
          headerClassName,
        )}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          {leading}
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-app-subtle transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
          strokeWidth={2}
        />
      </button>
      {open ? (
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden",
            fillAvailable || footerFill ? "flex-1" : "shrink-0",
          )}
        >
          {hasContent ? (
            <div
              className={cn(
                footerFill
                  ? "max-h-[45%] shrink-0 overflow-y-auto"
                  : fillAvailable
                    ? "min-h-0 flex-1 overflow-y-auto"
                    : "shrink-0",
                contentClassName,
              )}
            >
              {children}
            </div>
          ) : null}
          {showFooter ? (
            <div
              className={cn(
                "px-3.5 pb-3 pt-2.5",
                footerFill ? "flex min-h-0 w-full flex-1 flex-col" : "shrink-0",
                footerClassName,
              )}
            >
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
      {!open && showFooter ? (
        <div
          className={cn(
            "shrink-0 px-3.5 pb-3 pt-2",
            !open && isCard && "rounded-b-2xl",
            footerClassName,
          )}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}
