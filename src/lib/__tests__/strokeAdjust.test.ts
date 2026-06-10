import { describe, expect, it } from "vitest";
import {
  clampStrokeWidth,
  DEFAULT_PENCIL_STROKE_WIDTH,
  isFreehandPathNode,
  nodeSupportsStrokeWidth,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
} from "../strokeAdjust";

describe("clampStrokeWidth", () => {
  it("clamps to min and max", () => {
    expect(clampStrokeWidth(-5)).toBe(STROKE_WIDTH_MIN);
    expect(clampStrokeWidth(999)).toBe(STROKE_WIDTH_MAX);
    expect(clampStrokeWidth(4)).toBe(4);
  });

  it("falls back for non-finite values", () => {
    expect(clampStrokeWidth(Number.NaN)).toBe(DEFAULT_PENCIL_STROKE_WIDTH);
  });
});

describe("nodeSupportsStrokeWidth", () => {
  it("includes open paths and vector shapes", () => {
    expect(nodeSupportsStrokeWidth({ type: "path", isBooleanGroup: false })).toBe(true);
    expect(nodeSupportsStrokeWidth({ type: "rectangle", isBooleanGroup: false })).toBe(true);
    expect(nodeSupportsStrokeWidth({ type: "text", isBooleanGroup: false })).toBe(false);
    expect(nodeSupportsStrokeWidth(null)).toBe(false);
  });
});

describe("isFreehandPathNode", () => {
  it("detects pencil strokes only", () => {
    expect(isFreehandPathNode({ type: "path", pathClosed: false })).toBe(true);
    expect(isFreehandPathNode({ type: "path", pathClosed: true })).toBe(false);
    expect(isFreehandPathNode({ type: "path", pathClosed: false, starPoints: 5 })).toBe(false);
    expect(isFreehandPathNode({ type: "path", pathClosed: false, polygonSides: 6 })).toBe(false);
    expect(isFreehandPathNode({ type: "rectangle" })).toBe(false);
  });
});
