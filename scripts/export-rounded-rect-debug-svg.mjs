#!/usr/bin/env node
/**
 * Export debug SVGs for rounded-rect path geometry verification.
 * Usage: npx tsx scripts/export-rounded-rect-debug-svg.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildRoundedRectComparisonDebugSvg,
  buildRoundedRectDebugSvg,
  logRoundedRectPathComparison,
} from "../src/lib/vector/roundedRectPathDebug.ts";

const outDir = join(process.cwd(), "debug-output");
mkdirSync(outDir, { recursive: true });

const params = { width: 140, height: 100, radius: 24 };

logRoundedRectPathComparison(params);

writeFileSync(
  join(outDir, "rounded-rect-comparison.svg"),
  buildRoundedRectComparisonDebugSvg(params),
  "utf8",
);

writeFileSync(
  join(outDir, "rounded-rect-smoothed-debug.svg"),
  buildRoundedRectDebugSvg({ ...params, smoothing: 0.6 }),
  "utf8",
);

console.log(`Wrote debug SVGs to ${outDir}/`);
