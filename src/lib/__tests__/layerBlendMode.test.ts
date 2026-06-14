import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLayerBlendMode,
  effectiveLayerBlendMode,
  figmaBlendModeToLayer,
  layerBlendModeToCss,
  svgLayerBlendStyleAttr,
} from "@/lib/layerBlendMode";

describe("layerBlendMode", () => {
  it("defaults pass-through for frames and normal for shapes", () => {
    assert.equal(defaultLayerBlendMode({ type: "frame" }), "pass-through");
    assert.equal(defaultLayerBlendMode({ type: "rectangle" }), "normal");
  });

  it("maps Figma API blend names", () => {
    assert.equal(figmaBlendModeToLayer("LINEAR_BURN"), "plus-darker");
    assert.equal(figmaBlendModeToLayer("SOFT_LIGHT"), "soft-light");
    assert.equal(figmaBlendModeToLayer("PASS_THROUGH"), "pass-through");
  });

  it("isolates normal on containers and applies mix-blend on modes", () => {
    assert.deepEqual(layerBlendModeToCss("pass-through", { type: "frame" }), {});
    assert.deepEqual(layerBlendModeToCss("normal", { type: "frame" }), { isolation: "isolate" });
    assert.deepEqual(layerBlendModeToCss("multiply", { type: "rectangle" }), {
      mixBlendMode: "multiply",
    });
    assert.deepEqual(layerBlendModeToCss("screen", { type: "rectangle" }), {
      mixBlendMode: "screen",
    });
    assert.deepEqual(layerBlendModeToCss("overlay", { type: "ellipse" }), {
      mixBlendMode: "overlay",
    });
    assert.deepEqual(layerBlendModeToCss("color-burn", { type: "rectangle" }), {
      mixBlendMode: "color-burn",
    });
  });

  it("coerces pass-through on non-containers to normal", () => {
    assert.equal(
      effectiveLayerBlendMode({ type: "rectangle", blendMode: "pass-through" }),
      "normal",
    );
  });

  it("emits SVG style attr for blend modes", () => {
    assert.match(
      svgLayerBlendStyleAttr({ type: "rectangle", blendMode: "multiply" }),
      /mix-blend-mode:multiply/,
    );
    assert.match(
      svgLayerBlendStyleAttr({ type: "rectangle", blendMode: "screen" }),
      /mix-blend-mode:screen/,
    );
    assert.match(
      svgLayerBlendStyleAttr({ type: "frame", blendMode: "normal" }),
      /isolation:isolate/,
    );
    assert.equal(svgLayerBlendStyleAttr({ type: "frame", blendMode: "pass-through" }), "");
  });
});
