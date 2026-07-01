/** Bridge capture fidelity offline verification bundle (see verify:bridge-capture). */

export const BRIDGE_CAPTURE_VERIFY_SCRIPT = "scripts/verify-bridge-capture-gate.mjs";

export const BRIDGE_CAPTURE_PATTERN_FIXTURES_MODULE =
  "src/lib/craftBridge/bridgeCapturePatternFixtures.ts";

export const BRIDGE_CAPTURE_REGRESSION_TESTS = [
  "src/lib/craftBridge/__tests__/bridgeCaptureValidate.test.ts",
  "src/lib/craftBridge/__tests__/bridgeCaptureGoldenFixtures.test.ts",
  "src/lib/craftBridge/__tests__/finalizeBridgeLiveCapture.test.ts",
] as const;

export const BRIDGE_CAPTURE_FIDELITY_MODULE = "src/lib/craftBridge/bridgeCaptureValidate.ts";

export const BRIDGE_CAPTURE_IMPORT_GATE_MODULES = [
  "src/lib/craftBridge/bridgeLiveImport.ts",
  "src/lib/craftBridge/applyBridgePendingImport.ts",
] as const;
