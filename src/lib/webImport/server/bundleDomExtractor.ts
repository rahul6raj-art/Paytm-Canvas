import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | null = null;

/** Pre-bundled plain JS executed via `eval` inside Playwright (see `domExtractor.bundle.js`). */
export function loadDomExtractorBundle(): string {
  if (cached) return cached;
  cached = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "domExtractor.bundle.js"),
    "utf8",
  );
  return cached;
}
