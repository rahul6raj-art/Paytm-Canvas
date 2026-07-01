import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { finalizeBridgeLiveCapture } from "@/lib/craftBridge/finalizeBridgeLiveCapture";
import {
  assertBridgeCaptureFidelity,
  validateBridgeCaptureFidelity,
} from "@/lib/craftBridge/bridgeCaptureValidate";
import { BRIDGE_CAPTURE_PATTERN_FIXTURES } from "@/lib/craftBridge/bridgeCapturePatternFixtures";

describe("bridge capture golden pattern fixtures", () => {
  for (const fixture of BRIDGE_CAPTURE_PATTERN_FIXTURES) {
    it(`${fixture.id} passes fidelity validation after finalize`, () => {
      const nodes = structuredClone(fixture.nodes);
      const childOrder = structuredClone(fixture.childOrder);

      if (fixture.runFinalize !== false) {
        finalizeBridgeLiveCapture(nodes, childOrder);
      }

      const result = validateBridgeCaptureFidelity(nodes, childOrder, {
        strict: true,
        tolerancePx: 1,
        requireRoundTripMetadata: fixture.validation?.requireRoundTripMetadata !== false,
      });

      if (!result.ok) {
        assert.fail(
          `${fixture.id}: ${result.errors.map((e) => e.message).join("; ")}`,
        );
      }
    });
  }

  it("detects misaligned assurance badge before finalize would fix it", () => {
    const fixture = BRIDGE_CAPTURE_PATTERN_FIXTURES.find(
      (f) => f.id === "assurance-badge-inline",
    )!;
    const nodes = structuredClone(fixture.nodes);
    const childOrder = structuredClone(fixture.childOrder);

    const result = validateBridgeCaptureFidelity(nodes, childOrder, {
      requireRoundTripMetadata: false,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.rule === "assurance-header-badge-alignment"));
  });

  it("assertBridgeCaptureFidelity throws with actionable message", () => {
    const fixture = BRIDGE_CAPTURE_PATTERN_FIXTURES.find(
      (f) => f.id === "assurance-badge-inline",
    )!;
    assert.throws(
      () =>
        assertBridgeCaptureFidelity(structuredClone(fixture.nodes), fixture.childOrder, {
          requireRoundTripMetadata: false,
        }),
      /assurance-header-badge-alignment/,
    );
  });
});
