import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTaperedOpenStrokeFromNode,
  buildTaperedStrokeFillD,
  expandOpenPolylineTaperedStroke,
  polylineArcLengthSamples,
  resolveStrokeTaperActive,
  resolveStrokeTaperConfig,
  resamplePolylineUniform,
  smoothstep,
  taperWeightAlongPath,
  taperWidthAtSample,
} from "@/lib/taperedStrokePath";
import { shouldUseTaperedOpenPathStroke } from "@/lib/strokeAlign";
import { resolveStrokeWidthProfile } from "@/lib/stroke";
import type { EditorNode } from "@/stores/useEditorStore";

function baseNode(partial: Partial<EditorNode> & Pick<EditorNode, "type">): EditorNode {
  return {
    id: "n1",
    parentId: null,
    name: "Path",
    x: 0,
    y: 0,
    width: 200,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#cccccc",
    fillEnabled: true,
    strokeColor: "#ffffff",
    strokeWidth: 20,
    strokeEnabled: true,
    strokePosition: "center",
    strokeStyle: "solid",
    pathClosed: false,
    pathPoints: [
      { id: "a", x: 0, y: 20 },
      { id: "b", x: 200, y: 20 },
    ],
    ...partial,
  };
}

describe("taperWeightAlongPath", () => {
  it("is zero at both ends and peaks at center (symmetric)", () => {
    assert.ok(taperWeightAlongPath(0, "symmetric") < 1e-10);
    assert.ok(taperWeightAlongPath(1, "symmetric") < 1e-10);
    assert.ok(taperWeightAlongPath(0.5, "symmetric") > 0.99);
  });

  it("start profile is full at t=0 and thin at t=1", () => {
    assert.ok(taperWeightAlongPath(0, "start") > 0.99);
    assert.ok(taperWeightAlongPath(1, "start") < 1e-10);
  });

  it("end profile is thin at t=0 and full at t=1", () => {
    assert.ok(taperWeightAlongPath(0, "end") < 1e-10);
    assert.ok(taperWeightAlongPath(1, "end") > 0.99);
  });

  it("uniform profile is constant", () => {
    assert.equal(taperWeightAlongPath(0, "uniform"), 1);
    assert.equal(taperWeightAlongPath(0.5, "uniform"), 1);
  });
});

describe("tapered open stroke geometry", () => {
  it("defaults open paths to uniform width profile when unset", () => {
    const node = baseNode({ type: "path", strokeLinecap: "round" });
    assert.equal(resolveStrokeWidthProfile(node), "uniform");
    assert.equal(resolveStrokeTaperActive(node), false);
    assert.equal(shouldUseTaperedOpenPathStroke(node, false), false);
  });

  it("leaves normal strokes unchanged when taper is inactive", () => {
    const node = baseNode({ type: "path", strokeLinecap: "butt", strokeWidthProfile: "uniform" });
    assert.equal(resolveStrokeTaperActive(node), false);
    assert.equal(shouldUseTaperedOpenPathStroke(node, false), false);
    assert.equal(buildTaperedOpenStrokeFromNode(node, "M 0 20 L 200 20", false), null);
  });

  it("activates taper for taper cap and explicit taper values", () => {
    assert.equal(resolveStrokeTaperActive(baseNode({ type: "path", strokeLinecap: "taper" })), true);
    assert.equal(resolveStrokeTaperActive(baseNode({ type: "path", strokeTaperStart: 0.5 })), true);
    assert.equal(resolveStrokeTaperActive(baseNode({ type: "path", strokeWidthProfile: "taper" })), true);
  });

  it("does not taper closed shapes", () => {
    const node = baseNode({ type: "path", strokeLinecap: "taper", pathClosed: true });
    assert.equal(buildTaperedOpenStrokeFromNode(node, "M 0 0 L 200 0 L 200 40 Z", true), null);
  });

  it("builds a closed tapered outline for an open line", () => {
    const node = baseNode({
      type: "path",
      strokeLinecap: "taper",
      strokeTaperLengthStart: 40,
      strokeTaperLengthEnd: 40,
    });
    const d = buildTaperedOpenStrokeFromNode(node, "M 0 20 L 200 20", false);
    assert.ok(d);
    assert.ok(d!.endsWith(" Z"));
    assert.ok((d!.match(/ L /g) || []).length >= 4);
  });

  it("tapers width to near zero at both endpoints", () => {
    const samples = resamplePolylineUniform(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      32,
    );
    const config = resolveStrokeTaperConfig(
      baseNode({
        type: "path",
        strokeLinecap: "taper",
        strokeTaperLengthStart: 30,
        strokeTaperLengthEnd: 30,
      }),
      { maxWidth: 20, totalLength: 100 },
    );
    assert.ok(taperWidthAtSample(samples[0]!, config) < 1);
    assert.ok(taperWidthAtSample(samples[samples.length - 1]!, config) < 1);
    assert.ok(taperWidthAtSample(samples[Math.floor(samples.length / 2)]!, config) > 15);
  });

  it("tapers cubic curves using tessellated path sampling", () => {
    const node = baseNode({
      type: "path",
      strokeLinecap: "taper",
      width: 120,
      height: 120,
      strokeTaperLengthStart: 30,
      strokeTaperLengthEnd: 30,
    });
    const curve = "M 10 100 C 40 10 80 190 110 20";
    const d = buildTaperedOpenStrokeFromNode(node, curve, false);
    assert.ok(d);
    assert.ok(d!.endsWith(" Z"));
    const startWidth = taperWidthAtSample(
      polylineArcLengthSamples([{ x: 10, y: 100 }])[0] ?? {
        x: 0,
        y: 0,
        t: 0,
        distanceFromStart: 0,
        distanceFromEnd: 100,
        totalLength: 100,
      },
      resolveStrokeTaperConfig(node, { maxWidth: 20, totalLength: 100 }),
    );
    assert.ok(startWidth < 1);
  });

  it("uses smoothstep ramp from 0 to taper length", () => {
    assert.equal(smoothstep(0, 10, 0), 0);
    assert.equal(smoothstep(0, 10, 10), 1);
    assert.ok(smoothstep(0, 10, 5) > 0.4);
    assert.ok(smoothstep(0, 10, 5) < 0.6);
  });

  it("returns a closed polygon from expandOpenPolylineTaperedStroke", () => {
    const samples = resamplePolylineUniform(
      [
        { x: 0, y: 10 },
        { x: 100, y: 10 },
      ],
      16,
    );
    const config = resolveStrokeTaperConfig(
      baseNode({ type: "path", strokeLinecap: "taper" }),
      { maxWidth: 12, totalLength: 100 },
    );
    const outline = expandOpenPolylineTaperedStroke(samples, config);
    assert.ok(outline.length >= 4);
    assert.ok(Math.abs(outline[0]!.x - outline[outline.length - 1]!.x) < 1e-6);
  });

  it("supports independent start and end taper amounts via buildTaperedStrokeFillD", () => {
    const d = buildTaperedStrokeFillD("M 0 0 L 120 0", {
      maxWidth: 16,
      taperStart: 1,
      taperEnd: 0,
      taperLengthStart: 24,
      taperLengthEnd: 24,
    });
    assert.ok(d);
    assert.ok(d!.endsWith(" Z"));
  });
});
