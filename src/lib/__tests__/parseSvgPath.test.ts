import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSvgPathToAbsolute } from "@/lib/svgImport/parseSvgPath";
import { svgPathDToPathPoints } from "@/lib/pathGeometry";

describe("parseSvgPath", () => {
  it("parses implicit lineto after moveto", () => {
    const segs = parseSvgPathToAbsolute("M 0 0 10 0 10 10");
    assert.equal(segs.length, 3);
    assert.equal(segs[0]!.type, "M");
    assert.equal(segs[1]!.type, "L");
    assert.equal((segs[1] as { x: number }).x, 10);
    assert.equal((segs[2] as { y: number }).y, 10);
  });

  it("parses relative moveto and lineto", () => {
    const segs = parseSvgPathToAbsolute("m 10 10 l 5 0 0 5");
    assert.ok(segs.length >= 3);
    assert.equal((segs[0] as { x: number }).x, 10);
    assert.equal((segs[2] as { y: number }).y, 15);
  });

  it("converts arcs to cubic segments", () => {
    const segs = parseSvgPathToAbsolute("M 0 0 A 10 10 0 0 1 20 0");
    const cubics = segs.filter((s) => s.type === "C");
    assert.ok(cubics.length >= 1);
    const points = svgPathDToPathPoints("M 0 0 A 10 10 0 0 1 20 0");
    assert.ok(points.length >= 2);
    assert.ok(points.some((p) => p.handleOut || p.handleIn));
  });

  it("parses smooth cubic S command", () => {
    const segs = parseSvgPathToAbsolute("M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0");
    assert.ok(segs.some((s) => s.type === "C"));
    const points = svgPathDToPathPoints("M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0");
    assert.ok(points.length >= 3);
  });

  it("parses close path", () => {
    const segs = parseSvgPathToAbsolute("M 0 0 L 10 0 L 10 10 Z");
    assert.equal(segs[segs.length - 1]!.type, "Z");
  });

  it("parses horizontal and vertical commands", () => {
    const segs = parseSvgPathToAbsolute("M 0 0 H 10 V 20 h -5 v -5");
    const lines = segs.filter((s) => s.type === "L");
    assert.equal(lines.length, 4);
    assert.equal((lines[3] as { y: number }).y, 15);
  });
});
