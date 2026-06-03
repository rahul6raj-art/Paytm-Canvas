"use client";

import { isPaytmCraftApiMode } from "@/lib/env";
import { cn } from "@/lib/utils";

export function PaytmCraftApiModeBanner({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  if (!isPaytmCraftApiMode()) return null;
  return (
    <div
      className={cn(
        "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
        variant === "light" && "border-sky-200 bg-sky-50 text-sky-950",
        variant === "dark" && "border-sky-500/35 bg-sky-500/15 text-sky-100",
        className,
      )}
      title="Dashboard and apiClient use /api/v1. Editor still saves to local storage."
    >
      API mode: mock server
    </div>
  );
}
