import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildNodeEffectRenderStyle,
  buildTextCanvasEffectRenderStyle,
  changeEffectType,
  defaultNodeEffect,
  mergeNodeEffectPatch,
} from "../nodeEffects";

describe("nodeEffects", () => {
  it("builds drop shadow and layer blur", () => {
    const drop = defaultNodeEffect("drop-shadow");
    const blur = defaultNodeEffect("layer-blur");
    const style = buildNodeEffectRenderStyle([drop, blur]);
    assert.ok(style.boxShadow?.includes("px"));
    assert.equal(style.filter, "blur(8px)");
  });

  it("canvas text drop shadow uses filter not box-shadow", () => {
    const drop = defaultNodeEffect("drop-shadow");
    drop.color = "#ff0000";
    const blur = defaultNodeEffect("layer-blur");
    const style = buildTextCanvasEffectRenderStyle([drop, blur]);
    assert.equal(style.boxShadow, undefined);
    assert.match(style.filter!, /drop-shadow\(/);
    assert.match(style.filter!, /blur\(8px\)/);
  });

  it("builds glass and noise overlays", () => {
    const glass = defaultNodeEffect("glass");
    const noise = defaultNodeEffect("noise");
    const style = buildNodeEffectRenderStyle([glass, noise]);
    assert.ok(style.backdropFilter?.includes("blur"));
    assert.ok(style.glassBackground);
    assert.equal(style.overlayLayers?.length, 1);
    assert.equal(style.overlayLayers![0]!.kind, "noise");
  });

  it("replaces effect on type change", () => {
    const shadow = defaultNodeEffect("drop-shadow");
    const next = mergeNodeEffectPatch(shadow, { type: "noise" });
    assert.equal(next.type, "noise");
    assert.equal(next.density, defaultNodeEffect("noise").density);
    assert.equal(next.x, undefined);
  });

  it("changeEffectType keeps id and visibility", () => {
    const e = defaultNodeEffect("layer-blur");
    e.visible = false;
    const next = changeEffectType(e, "glass");
    assert.equal(next.id, e.id);
    assert.equal(next.visible, false);
    assert.equal(next.type, "glass");
  });
});
