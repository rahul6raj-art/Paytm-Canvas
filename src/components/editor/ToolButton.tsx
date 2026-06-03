"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function ToolButton({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border text-app-muted transition-colors",
        "border-transparent hover:border-app-border hover:bg-app-hover hover:text-app-fg",
        active &&
          "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.2)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
      {...props}
    />
  );
}
