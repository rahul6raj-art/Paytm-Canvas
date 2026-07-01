import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveBridgeProjectCssVariable,
  resolveBridgeTextfieldBorderStrokeColor,
} from "@/lib/craftBridge/bridgeCaptureProjectTokens";

const PML_COLORS_CSS = `
:root {
  --border-neutral-medium: #E0E0E0;
}
[data-theme='dark'] {
  --border-neutral-medium: #414244;
}
`;

describe("bridgeCaptureProjectTokens", () => {
  it("resolves --border-neutral-medium from linked project CSS", () => {
    assert.equal(
      resolveBridgeProjectCssVariable([PML_COLORS_CSS], "--border-neutral-medium", "light"),
      "#E0E0E0",
    );
    assert.equal(
      resolveBridgeProjectCssVariable([PML_COLORS_CSS], "--border-neutral-medium", "dark"),
      "#414244",
    );
  });

  it("keeps captured neutral border and swaps focus green for the project token", () => {
    assert.equal(
      resolveBridgeTextfieldBorderStrokeColor("#d0d0d0", [PML_COLORS_CSS], "light"),
      "#d0d0d0",
    );
    assert.equal(
      resolveBridgeTextfieldBorderStrokeColor("#34A34D", [PML_COLORS_CSS], "light"),
      "#E0E0E0",
    );
  });
});
