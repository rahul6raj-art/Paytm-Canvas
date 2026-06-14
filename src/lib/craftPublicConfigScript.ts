import { craftPublicConfigFromEnv } from "@/lib/craftPublicConfig";

/** Inline script for root layout — runtime renderer config (avoids stale client env bundles). */
export function craftPublicConfigInitScript(): string {
  const cfg = craftPublicConfigFromEnv();
  return `window.__CRAFT_PUBLIC_CONFIG__=${JSON.stringify(cfg)};`;
}
