import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importSvgSourceToEditorGraph } from "@/lib/svgImport";

describe("svgImport pipeline", () => {
  it("scales viewBox to width/height attributes", () => {
    const source = `<svg width="400" height="200" viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="50" fill="#f00"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "scaled.svg");
    assert.ok(result);
    const root = result.nodes[result.rootId];
    assert.equal(root?.width, 100);
    assert.equal(root?.height, 50);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.equal(rect?.width, 100);
    assert.equal(rect?.height, 50);
  });

  it("imports nested group children in group-local coordinates", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(10 20)">
        <rect x="5" y="5" width="10" height="10" fill="#f00"/>
      </g>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "nested.svg");
    assert.ok(result);
    const group = Object.values(result.nodes).find((n) => n.type === "group");
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.ok(group);
    assert.ok(rect);
    assert.equal(rect?.parentId, group?.id);
    assert.equal(rect?.x, 0);
    assert.equal(rect?.y, 0);
    assert.equal(group?.x, 15);
    assert.equal(group?.y, 25);
    assert.ok((group?.width ?? 0) >= 10);
    assert.ok((group?.height ?? 0) >= 10);
  });

  it("imports nested group transforms", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(20 10)">
        <rect x="0" y="0" width="10" height="10" fill="#00f"/>
      </g>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "group.svg");
    assert.ok(result);
    const group = Object.values(result.nodes).find((n) => n.type === "group");
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.ok(group);
    assert.ok(rect);
    assert.equal(rect?.parentId, group?.id);
    assert.equal(rect?.x, 0);
    assert.equal(rect?.y, 0);
    assert.equal(group?.x, 20);
    assert.equal(group?.y, 10);
  });

  it("imports group rotate(angle cx cy) without DOMMatrix warnings", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(90 50 50)">
        <rect x="40" y="10" width="20" height="80" fill="#f00"/>
      </g>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "rotate.svg");
    assert.ok(result);
    const group = Object.values(result.nodes).find((n) => n.type === "group");
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.ok(group);
    assert.ok(rect);
    assert.ok(Math.abs((group?.rotation ?? 0) - 90) < 0.5);
    assert.equal(
      result.diagnostics.warnings.filter((w) => w.includes("DOMMatrix")).length,
      0,
    );
    assert.equal(result.diagnostics.failedTransforms.length, 0);
  });

  it("imports use references to paths and groups in defs", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <path id="p" d="M 0 0 L 20 0 L 10 20 Z" fill="#111"/>
        <g id="g">
          <rect x="0" y="0" width="8" height="8" fill="#222"/>
        </g>
      </defs>
      <use href="#p" x="10" y="10"/>
      <use href="#g" x="30" y="30"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "use.svg");
    assert.ok(result);
    const paths = Object.values(result.nodes).filter((n) => n.type === "path");
    const rects = Object.values(result.nodes).filter((n) => n.type === "rectangle");
    assert.equal(paths.length, 1);
    assert.equal(rects.length, 1);
    assert.ok((paths[0]?.x ?? 0) >= 9);
    assert.ok((rects[0]?.x ?? 0) >= 29);
  });

  it("imports evenodd fill rule on paths", () => {
    const source = `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M 5 5 L 45 5 L 25 45 Z" fill="#abc" fill-rule="evenodd"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "evenodd.svg");
    assert.ok(result);
    const path = Object.values(result.nodes).find((n) => n.type === "path");
    assert.equal(path?.pathFillRule, "evenodd");
    assert.equal(path?.pathClosed, true);
  });

  it("keeps multi-path icon subpaths aligned in node-local flattened geometry", () => {
    const source = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.75 3H20.25V21H3.75Z" fill="#111"/>
      <path d="M7.57715 5.5127H8.32715V16.5957H7.57715Z" fill="#111"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "chart.svg");
    assert.ok(result);
    const paths = Object.values(result.nodes).filter((n) => n.type === "path");
    assert.equal(paths.length, 2);
    for (const path of paths) {
      assert.ok(path.flattenedPathData);
      const move = path.flattenedPathData!.match(/M\s+([\d.+-]+)\s+([\d.+-]+)/);
      assert.ok(move);
      const localX = parseFloat(move![1]!);
      const localY = parseFloat(move![2]!);
      assert.ok(localX >= -0.01 && localX <= 1.5, `unexpected local x ${localX}`);
      assert.ok(localY >= -0.01 && localY <= 1.5, `unexpected local y ${localY}`);
      assert.ok(Math.abs(path.x + localX - 3.75) < 0.01 || Math.abs(path.x + localX - 7.57715) < 0.01);
    }
  });

  it("ignores radial gradient defs and keeps solid fill", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rg" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="50">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#rg)"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "radial.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.notEqual(rect?.fillType, "gradient");
    assert.equal(rect?.fill, "#000000");
  });

  it("ignores linear gradient defs and keeps solid fill", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ff0000"/>
          <stop offset="100%" stop-color="#0000ff"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#g1)"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "grad.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.notEqual(rect?.fillType, "gradient");
    assert.equal(rect?.fill, "#000000");
  });

  it("defaults fill to black when not specified", () => {
    const source = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <rect width="10" height="10"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "default.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    assert.equal(rect?.fill, "#000000");
    assert.equal(rect?.fillEnabled, true);
  });

  it("records diagnostics for unsupported elements", () => {
    const source = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <filter id="f"><feGaussianBlur/></filter>
      <rect width="10" height="10" fill="#000"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "filter.svg");
    assert.ok(result);
    assert.ok(result.diagnostics.warnings.length > 0);
  });
});
