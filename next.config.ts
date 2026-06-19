import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  /** Ensure .env.local and tracing resolve to this app, not a parent lockfile directory. */
  outputFileTracingRoot: projectRoot,
  /** Self-hosted Docker only — Vercel uses its own output pipeline. */
  ...(isVercel ? {} : { output: "standalone" as const }),
  /** Hide the Next.js dev-mode corner badge (errors still surface in the overlay). */
  devIndicators: false,
  serverExternalPackages: [
    "@paytm-craft/bridge",
    "@cursor/sdk",
    "playwright",
    "openfig-core",
  ],
};

export default nextConfig;
