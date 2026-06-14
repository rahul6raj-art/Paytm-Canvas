import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectRuntimeFontRequests } from "@/engine/craftEngineFontBridge";
import type { EditorFontAsset } from "@/lib/documentPersistence";
import type { FontFamilyOption } from "@/lib/fonts/fontCatalog";
import type { EditorNode } from "@/stores/useEditorStore";

function textNode(fontFamily: string, fontWeight?: number): EditorNode {
  return {
    id: "t1",
    type: "text",
    name: "Text",
    x: 0,
    y: 0,
    width: 120,
    height: 40,
    fontFamily,
    fontWeight,
    content: "Hello",
  } as EditorNode;
}

describe("craftEngineFontBridge", () => {
  it("collects Google font weights for non-embedded families", () => {
    const nodes = {
      t1: textNode('"Poppins", system-ui, sans-serif', 700),
    };
    const reqs = collectRuntimeFontRequests(nodes);
    assert.ok(reqs.some((r) => r.family === "Poppins" && r.weight === 400));
    assert.ok(reqs.some((r) => r.family === "Poppins" && r.weight === 700));
  });

  it("skips embedded Inter and Roboto", () => {
    const nodes = {
      a: textNode("Inter, system-ui, sans-serif"),
      b: textNode("Roboto, sans-serif", 700),
    };
    assert.equal(collectRuntimeFontRequests(nodes).length, 0);
  });

  it("ignores non-text nodes", () => {
    const nodes = {
      r1: { id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10 } as EditorNode,
    };
    assert.equal(collectRuntimeFontRequests(nodes).length, 0);
  });

  it("collects uploaded font requests from fontAssets", () => {
    const fontAssets: Record<string, EditorFontAsset> = {
      f1: {
        id: "f1",
        family: "Brand Sans",
        weight: 400,
        fileName: "Brand Sans.ttf",
        mimeType: "font/ttf",
        dataUrl: "data:font/ttf;base64,AA==",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const nodes = {
      t1: textNode('"Brand Sans", system-ui, sans-serif'),
    };
    const reqs = collectRuntimeFontRequests(nodes, fontAssets);
    assert.ok(reqs.some((r) => r.source === "uploaded" && r.family === "Brand Sans"));
  });

  it("collects installed font requests when catalog matches", () => {
    const catalog: FontFamilyOption[] = [
      {
        id: "local-helvetica",
        label: "Helvetica Neue",
        value: '"Helvetica Neue", system-ui, sans-serif',
        source: "installed",
        primary: "Helvetica Neue",
      },
    ];
    const nodes = {
      t1: textNode('"Helvetica Neue", system-ui, sans-serif', 400),
    };
    const reqs = collectRuntimeFontRequests(nodes, undefined, catalog);
    assert.equal(reqs.length, 2);
    assert.ok(reqs.every((r) => r.source === "installed" && r.family === "Helvetica Neue"));
  });
});
