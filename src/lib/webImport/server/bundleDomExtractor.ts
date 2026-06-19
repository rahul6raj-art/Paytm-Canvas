import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const bundlePath = join(dirname(fileURLToPath(import.meta.url)), "domExtractor.bundle.js");
let cached: { mtimeMs: number; code: string } | null = null;

/** Pre-bundled plain JS executed via `eval` inside Playwright (see `domExtractor.bundle.js`). */
export function loadDomExtractorBundle(): string {
  const mtimeMs = statSync(bundlePath).mtimeMs;
  if (cached && cached.mtimeMs === mtimeMs) return cached.code;
  const code = readFileSync(bundlePath, "utf8");
  cached = { mtimeMs, code };
  return code;
}
