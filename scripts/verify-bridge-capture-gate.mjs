#!/usr/bin/env node
/**
 * Offline verification for bridge capture fidelity (pattern fixtures + validator + finalize).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "src/lib/craftBridge/bridgeCaptureValidate.ts",
  "src/lib/craftBridge/bridgeCapturePatternFixtures.ts",
  "src/lib/bridgeCaptureVerifyManifest.ts",
  "src/lib/craftBridge/bridgeLiveImport.ts",
];

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("[verify:bridge-capture] checking bridge fidelity modules");
for (const path of REQUIRED) {
  if (!existsSync(join(root, path))) {
    console.error(`[verify:bridge-capture] missing ${path}`);
    process.exit(1);
  }
}

console.log("[verify:bridge-capture] running pattern fixture + validator tests");
run("npx", [
  "tsx",
  "--test",
  "src/lib/craftBridge/__tests__/bridgeCaptureValidate.test.ts",
  "src/lib/craftBridge/__tests__/bridgeCaptureGoldenFixtures.test.ts",
]);

console.log("[verify:bridge-capture] ok");
