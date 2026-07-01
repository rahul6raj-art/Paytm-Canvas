import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  BRIDGE_CAPTURE_FIDELITY_MODULE,
  BRIDGE_CAPTURE_IMPORT_GATE_MODULES,
  BRIDGE_CAPTURE_REGRESSION_TESTS,
  BRIDGE_CAPTURE_VERIFY_SCRIPT,
} from "@/lib/bridgeCaptureVerifyManifest";

const root = process.cwd();

describe("bridgeCaptureVerifyGate", () => {
  it("verify script exists and runs golden fixture tests", () => {
    const script = readFileSync(join(root, BRIDGE_CAPTURE_VERIFY_SCRIPT), "utf8");
    assert.match(script, /bridgeCaptureGoldenFixtures\.test\.ts/);
    assert.match(script, /bridgeCaptureValidate\.ts/);
  });

  it("fidelity validator is wired into bridge import paths", () => {
    for (const mod of BRIDGE_CAPTURE_IMPORT_GATE_MODULES) {
      const src = readFileSync(join(root, mod), "utf8");
      assert.match(src, /validateBridgeCaptureFidelity|assertBridgeCaptureFidelity/);
    }
  });

  it("regression test files exist", () => {
    for (const testPath of BRIDGE_CAPTURE_REGRESSION_TESTS) {
      assert.ok(existsSync(join(root, testPath)), testPath);
    }
    assert.ok(existsSync(join(root, BRIDGE_CAPTURE_FIDELITY_MODULE)));
  });
});
