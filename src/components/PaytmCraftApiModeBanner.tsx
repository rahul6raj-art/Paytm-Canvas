"use client";

import { getPaytmCraftPublicEnv, isPaytmCraftApiMode, isPaytmCraftHttpApiMode } from "@/lib/env";
import { cn } from "@/lib/utils";

export function PaytmCraftApiModeBanner({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  if (!isPaytmCraftHttpApiMode()) return null;

  const env = getPaytmCraftPublicEnv();
  const label = isPaytmCraftApiMode()
    ? "API mode: mock server"
    : env.apiUrl
      ? `Remote API: ${env.apiUrl}`
      : "Remote API: not configured";

  const title = isPaytmCraftApiMode()
    ? "Dashboard and apiClient use /api/v1. Editor saves to local cache + mock API when a file session is active."
    : env.apiUrl
      ? `apiClient calls ${env.apiUrl}. Editor saves to local cache + remote API when a file session is active.`
      : "Set NEXT_PUBLIC_PAYTM_CRAFT_API_URL to connect a real backend.";

  return (
    <div
      className={cn(
        "shrink-0 rounded-md border px-2.5 py-1 text-ui font-semibold tabular-nums",
        variant === "light" && "border-sky-200 bg-sky-50 text-sky-950",
        variant === "dark" && "border-sky-500/35 bg-sky-500/15 text-sky-100",
        !isPaytmCraftApiMode() && !env.apiUrl && "border-amber-500/35 bg-amber-500/12 text-amber-100",
        className,
      )}
      title={title}
    >
      {label}
    </div>
  );
}
