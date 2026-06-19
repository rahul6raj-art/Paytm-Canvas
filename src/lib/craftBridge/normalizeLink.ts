import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

/** Canvas → source is manual-only; never auto-write from persisted "auto" links. */
export function normalizeCodeRoundTripLink(
  link: CodeRoundTripLink | null,
): CodeRoundTripLink | null {
  if (!link) return null;
  return {
    ...link,
    syncMode: "manual",
    watchSource: link.watchSource ?? false,
  };
}
