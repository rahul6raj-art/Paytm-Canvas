import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateRoundedCorner,
  clamp,
  createRoundedPathSvgD,
  createRoundedVectorPathSvgD,
  figmaCornerRadiusToArcRadius,
  generatePolygonPoints,
  generateStarPoints,
  interiorAngleAtVertex,
  maxFigmaVertexCornerRadius,
  maxQuadraticCornerRadiusAtVertex,
} from "@/lib/geometry";
import { starPathD } from "@/lib/shapes/starGeometry";
import { newPathPointId } from "@/lib/pathGeometry";

describe("roundedCornerGeometry", () => {
  it("clamps radius per vertex (Figma half-edge rule)", () => {
    const prev = { x: 0, y: 0 };
    const curr = { x: 10, y: 0 };
    const next = { x: 10, y: 10 };
    const max = maxFigmaVertexCornerRadius(10, 10);
    assert.equal(maxQuadraticCornerRadiusAtVertex(prev, curr, next), max);
    const corner = calculateRoundedCorner(prev, curr, next, max + 50);
    assert.equal(corner.radius, max);
    assert.ok(corner.radius <= 5);
  });

  it("maps Figma corner radius to circular arc radius via tan(theta/2)", () => {
    const rightAngle = Math.PI / 2;
    assert.ok(Math.abs(figmaCornerRadiusToArcRadius(10, rightAngle) - 10) < 1e-6);

    const equilateral = Math.PI / 3;
    const arcR = figmaCornerRadiusToArcRadius(12, equilateral);
    assert.ok(Math.abs(arcR - 12 * Math.tan(Math.PI / 6)) < 1e-6);
  });

  it("uses circular arc commands for rounded polygon", () => {
    const points = generatePolygonPoints({ width: 100, height: 100, sides: 6 });
    const d = createRoundedPathSvgD(points, () => 8, true);
    assert.ok(d.includes(" A "), "rounded polygon uses circular arcs");
    assert.ok(!d.includes(" Q "), "rounded polygon does not use quadratic curves");
    assert.ok(d.endsWith(" Z"));
  });

  it("star supports independent outer and inner corner radius", () => {
    const outerOnly = starPathD(100, 100, 5, 0.4, 0, 10, 0);
    const innerOnly = starPathD(100, 100, 5, 0.4, 0, 0, 10);
    assert.ok(outerOnly.includes(" A "));
    assert.notEqual(outerOnly, innerOnly);
  });

  it("open vector path keeps endpoints sharp", () => {
    const p0 = newPathPointId();
    const p1 = newPathPointId();
    const p2 = newPathPointId();
    const d = createRoundedVectorPathSvgD({
      closed: false,
      points: [
        { id: p0, x: 0, y: 0 },
        { id: p1, x: 50, y: 50, cornerRadius: 12 },
        { id: p2, x: 100, y: 0 },
      ],
    });
    assert.ok(d.startsWith("M 0 0"));
    assert.ok(d.endsWith("100 0"));
    assert.ok(d.includes(" A "));
  });

  it("generateStarPoints produces alternating radii vertices", () => {
    const verts = generateStarPoints({ width: 100, height: 100, points: 5, ratio: 0.4 });
    assert.equal(verts.length, 10);
    assert.ok(verts[0]!.y < verts[1]!.y);
  });

  it("clamp utility bounds values", () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-1, 0, 3), 0);
  });

  it("interior angle at right-angle corner is pi/2", () => {
    const prev = { x: 0, y: 0 };
    const curr = { x: 10, y: 0 };
    const next = { x: 10, y: 10 };
    assert.ok(Math.abs(interiorAngleAtVertex(prev, curr, next) - Math.PI / 2) < 1e-6);
  });
});
