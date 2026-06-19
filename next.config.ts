import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Ensure .env.local and tracing resolve to this app, not a parent lockfile directory. */
  outputFileTracingRoot: projectRoot,
  /** Self-hosted Docker image — see deploy/web/Dockerfile */
  output: "standalone",
  /** Hide the Next.js dev-mode corner badge (errors still surface in the overlay). */
  devIndicators: false,
  serverExternalPackages: ["@paytm-craft/bridge", "@cursor/sdk"],
};

export default nextConfig;
