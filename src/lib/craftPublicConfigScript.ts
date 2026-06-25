import { craftPublicConfigFromEnv } from "@/lib/craftPublicConfig";
import { readPaytmCraftPublicEnvFromProcessEnv } from "@/lib/env";

/** Inline script for root layout — runtime config (avoids stale client env bundles). */
export function craftPublicConfigInitScript(): string {
  const cfg = craftPublicConfigFromEnv();
  const env = readPaytmCraftPublicEnvFromProcessEnv();
  return [
    `window.__CRAFT_PUBLIC_CONFIG__=${JSON.stringify(cfg)};`,
    `window.__CRAFT_PUBLIC_ENV__=${JSON.stringify(env)};`,
  ].join("");
}
