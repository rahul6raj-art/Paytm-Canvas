import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FigDocument, FigNode } from "openfig-core";
import { pickCanvasScreenRoots } from "@/lib/figImport/figCanvasRoots";

function frame(name: string, x: number, y: number, w: number, h: number): FigNode {
  return {
    type: "FRAME",
    name,
    phase: "CREATED",
    size: { x: w, y: h },
    transform: { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y },
  } as FigNode;
}

function docWithCanvas(children: FigNode[], canvasName = "Page 1"): FigDocument {
  const canvas: FigNode = { type: "CANVAS", name: canvasName, phase: "CREATED" } as FigNode;
  const nodes = [canvas, ...children];
  const childrenMap = new Map<string, FigNode[]>();
  childrenMap.set("0:1", children);
  return {
    nodes,
    nodeMap: new Map(nodes.map((n, i) => [`0:${i + 2}`, n])),
    childrenMap,
  } as unknown as FigDocument;
}

describe("pickCanvasScreenRoots", () => {
  it("prefers a frame matching the .fig file name", () => {
    const fig = docWithCanvas([
      frame("Figma cover", 0, 0, 200, 200),
      frame("Checkout Flow", 500, 0, 390, 844),
      frame("Icon / Button", 0, 0, 48, 48),
    ]);
    const picked = pickCanvasScreenRoots(fig, "0:1", { fileName: "Checkout Flow.fig" });
    assert.equal(picked.length, 1);
    assert.equal(picked[0]!.name, "Checkout Flow");
  });

  it("does not prefer a generic Page frame over the file name", () => {
    const fig = docWithCanvas([
      frame("Page", 0, 0, 960, 640),
      frame("Default - Real Estate", 0, 0, 390, 844),
    ]);
    const picked = pickCanvasScreenRoots(fig, "0:1", {
      fileName: "My App.fig",
      figDocumentName: "Default - Real Estate",
      pageName: "Page 1",
    });
    assert.equal(picked[0]!.name, "Default - Real Estate");
  });

  it("imports one primary screen when many frames exist", () => {
    const fig = docWithCanvas([
      frame("Thumb", 0, 0, 100, 100),
      frame("Home", 0, 0, 1440, 900),
      frame("Settings", 2000, 0, 390, 844),
    ]);
    const picked = pickCanvasScreenRoots(fig, "0:1", { fileName: "Untitled.fig" });
    assert.equal(picked.length, 1);
    assert.equal(picked[0]!.name, "Home");
  });
});
