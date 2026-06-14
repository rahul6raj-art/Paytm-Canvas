import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateImportWebUrl, sanitizeImportText } from "../urlValidation";
import { filterDomSnapshotTree, isVisibleSnapshotNode } from "../domFilter";
import { domSnapshotToScene } from "../pipeline";
import { detectSections } from "../sectionDetector";
import type { DomSnapshotNode } from "../types";

function node(partial: Partial<DomSnapshotNode> & Pick<DomSnapshotNode, "id" | "tagName" | "rect">): DomSnapshotNode {
  return {
    styles: {},
    children: [],
    ...partial,
  };
}

describe("validateImportWebUrl", () => {
  it("accepts https URLs", () => {
    const r = validateImportWebUrl("https://example.com/page");
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.url, /^https:\/\/example\.com/);
  });

  it("blocks localhost", () => {
    const r = validateImportWebUrl("http://localhost:3000");
    assert.equal(r.ok, false);
  });

  it("blocks private IPs", () => {
    const r = validateImportWebUrl("http://192.168.1.1");
    assert.equal(r.ok, false);
  });

  it("blocks file protocol", () => {
    const r = validateImportWebUrl("file:///etc/passwd");
    assert.equal(r.ok, false);
  });
});

describe("domFilter", () => {
  it("removes script nodes", () => {
    const root = node({
      id: "1",
      tagName: "body",
      rect: { x: 0, y: 0, width: 100, height: 100 },
      children: [
        node({
          id: "2",
          tagName: "script",
          rect: { x: 0, y: 0, width: 0, height: 0 },
        }),
      ],
    });
    const filtered = filterDomSnapshotTree(root);
    assert.ok(filtered);
    assert.equal(filtered!.children.length, 0);
  });

  it("filters zero-size elements", () => {
    const n = node({
      id: "z",
      tagName: "div",
      rect: { x: 0, y: 0, width: 0, height: 10 },
      styles: { display: "block", opacity: "1" },
    });
    assert.equal(isVisibleSnapshotNode(n), false);
  });
});

describe("domSnapshotToScene", () => {
  it("maps text nodes with styles", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 400, height: 200 },
      children: [
        node({
          id: "t1",
          tagName: "p",
          text: "Hello world",
          rect: { x: 10, y: 20, width: 120, height: 24 },
          styles: {
            display: "block",
            opacity: "1",
            color: "rgb(17, 17, 17)",
            fontSize: "16px",
            fontWeight: "600",
            textAlign: "center",
          },
          children: [],
        }),
      ],
    });
    const { scene } = domSnapshotToScene(root, {
      title: "Test",
      url: null,
      width: 400,
      height: 200,
    });
    const textChild = scene.children?.[0];
    assert.equal(textChild?.type, "text");
    assert.equal(textChild?.content, "Hello world");
    assert.equal(textChild?.fontWeight, 600);
    assert.equal(textChild?.textAlign, "center");
  });

  it("maps image nodes with asset", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 200, height: 200 },
      children: [
        node({
          id: "img1",
          tagName: "img",
          src: "https://example.com/a.png",
          rect: { x: 0, y: 0, width: 80, height: 60 },
          styles: { display: "block", opacity: "1" },
        }),
      ],
    });
    const { scene, assets } = domSnapshotToScene(root, {
      title: "Img",
      url: null,
      width: 200,
      height: 200,
    });
    const img = scene.children?.[0];
    assert.equal(img?.type, "image");
    assert.ok(img?.assetId);
    assert.ok(Object.keys(assets).length >= 1);
  });
});

describe("sectionDetector", () => {
  it("detects header sections", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 800, height: 600 },
      children: [
        node({
          id: "hdr",
          tagName: "header",
          sectionHint: "header",
          rect: { x: 0, y: 0, width: 800, height: 64 },
          children: [node({ id: "c1", tagName: "span", rect: { x: 0, y: 0, width: 40, height: 20 } })],
        }),
      ],
    });
    const sections = detectSections(root);
    assert.ok(sections.some((s) => s.kind === "header"));
  });
});

describe("sanitizeImportText", () => {
  it("strips script tags", () => {
    const out = sanitizeImportText('Hi<script>alert(1)</script>', 100);
    assert.ok(!out.includes("script"));
  });
});
