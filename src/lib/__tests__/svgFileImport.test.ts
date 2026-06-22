import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  convertSvgTree,
  importSvgSourceToEditorGraph,
  isSvgLayerImportFile,
  parseSvg,
  readSvg,
} from "@/lib/svgFileImport";
import { insertImportedNodes } from "@/lib/svgImportInsert";
import type { EditorNode } from "@/stores/useEditorStore";

describe("svgFileImport", () => {
  it("detects svg layer import files", () => {
    const svg = new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" });
    const png = new File([new Uint8Array([1])], "photo.png", { type: "image/png" });
    assert.equal(isSvgLayerImportFile(svg), true);
    assert.equal(isSvgLayerImportFile(png), false);
  });

  it("imports grouped svg layers into a frame with children", () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="Background">
    <rect id="Sky" x="0" y="0" width="100" height="100" fill="#87ceeb"/>
  </g>
  <g id="Foreground">
    <circle id="Sun" cx="80" cy="20" r="12" fill="#ffd700"/>
    <path id="Hill" d="M0 80 L50 40 L100 80 Z" fill="#2d6a4f"/>
  </g>
</svg>`;

    const result = importSvgSourceToEditorGraph(source, "landscape.svg");
    assert.ok(result);
    const { nodes, childOrder, rootId } = result;

    const root = nodes[rootId];
    assert.equal(root?.type, "frame");
    assert.equal(root?.name, "landscape");
    assert.equal(root?.width, 100);
    assert.equal(root?.height, 100);

    const rootKids = childOrder[rootId] ?? [];
    assert.equal(rootKids.length, 2);

    const background = nodes[rootKids[0]!];
    const foreground = nodes[rootKids[1]!];
    assert.equal(background?.type, "group");
    assert.equal(background?.name, "Background");
    assert.equal(foreground?.type, "group");
    assert.equal(foreground?.name, "Foreground");

    const bgKids = childOrder[background!.id] ?? [];
    const fgKids = childOrder[foreground!.id] ?? [];
    assert.equal(bgKids.length, 1);
    assert.equal(fgKids.length, 2);
    assert.equal(nodes[bgKids[0]!]?.name, "Sky");
    assert.equal(nodes[bgKids[0]!]?.type, "rectangle");
    assert.equal(nodes[fgKids[0]!]?.name, "Sun");
    assert.equal(nodes[fgKids[1]!]?.name, "Hill");
    assert.equal(nodes[fgKids[1]!]?.type, "path");

    assert.ok((childOrder[EDITOR_ROOT_KEY] ?? []).includes(rootId));
  });

  it("imports filled logo paths as visible vectors (Google icon style)", () => {
    const source = `<?xml version="1.0" encoding="utf-8"?>
<svg width="800px" height="800px" viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg">
  <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/>
  <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/>
  <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/>
  <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/>
</svg>`;

    const result = importSvgSourceToEditorGraph(source, "google-icon-logo-svgrepo-com.svg");
    assert.ok(result);
    const kids = result.childOrder[result.rootId] ?? [];
    assert.equal(kids.length, 4);
    const paths = kids.map((id) => result.nodes[id]!);
    assert.ok(paths.every((n) => n.type === "path"));
    assert.ok(paths.every((n) => n.name === "Vector"));
    assert.ok(paths.every((n) => n.fillEnabled && n.pathPoints && n.pathPoints.length >= 2));
    assert.ok(paths.every((n) => n.flattenedPathData && n.flattenedPathData.length > 0));
    assert.ok(paths.every((n) => n.pathPoints!.some((p) => p.handleIn || p.handleOut)));
    assert.deepEqual(
      paths.map((n) => n.fill?.toUpperCase()).sort(),
      ["#34A853", "#4285F4", "#EB4335", "#FBBC05"].sort(),
    );
    assert.equal(result.nodes[result.rootId]?.clipChildren, false);
  });

  it("imports stroke styles and transforms on shapes", () => {
    const source = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="30" height="20" fill="#ff0000" stroke="#0000ff" stroke-width="4"
        stroke-linecap="round" stroke-linejoin="bevel" opacity="0.8" transform="translate(5 5) scale(2)"/>
      <circle cx="70" cy="70" r="15" fill="#00ff00"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "styled.svg");
    assert.ok(result);
    const rect = Object.values(result.nodes).find((n) => n.type === "rectangle");
    const circle = Object.values(result.nodes).find((n) => n.type === "ellipse");
    assert.ok(rect);
    assert.ok(circle);
    assert.equal(rect.fill, "#ff0000");
    assert.equal(rect.strokeColor, "#0000ff");
    assert.equal(rect.strokeWidth, 4);
    assert.equal(rect.strokeLinecap, "round");
    assert.equal(rect.strokeLinejoin, "bevel");
    assert.equal(rect.fillOpacity, 0.8);
    assert.equal(rect.width, 60);
    assert.equal(rect.height, 40);
    assert.equal(rect.x, 25);
    assert.equal(rect.y, 25);
    assert.equal(circle.fill, "#00ff00");
    assert.equal(circle.width, 30);
    assert.equal(circle.height, 30);
  });

  it("imports closed polygon paths as editable vectors", () => {
    const source = `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <polygon points="5,5 45,5 25,45" fill="#abcdef"/>
    </svg>`;
    const result = importSvgSourceToEditorGraph(source, "triangle.svg");
    assert.ok(result);
    const path = Object.values(result.nodes).find((n) => n.type === "path");
    assert.ok(path?.pathPoints && path.pathPoints.length === 3);
    assert.equal(path.pathClosed, true);
    assert.equal(path.fill, "#abcdef");
  });

  it("exposes parse/convert pipeline helpers", () => {
    const source = `<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`;
    assert.ok(parseSvg(source));
    assert.ok(convertSvgTree(source, "mini.svg"));
  });

  it("insertImportedNodes places scaled root at drop point", () => {
    const source = `<svg viewBox="0 0 200 100"><rect width="200" height="100" fill="#111"/></svg>`;
    const imported = importSvgSourceToEditorGraph(source, "wide.svg");
    assert.ok(imported);
    const merged = insertImportedNodes(imported, 400, 300, {
      nodes: { [EDITOR_ROOT_KEY]: { id: EDITOR_ROOT_KEY, parentId: null, type: "frame", name: "Page", x: 0, y: 0, width: 1000, height: 1000, rotation: 0, visible: true, locked: false, expanded: true } as EditorNode },
      childOrder: { [EDITOR_ROOT_KEY]: [] },
      assets: {},
      selectedIds: [],
    });
    const root = merged.nodes[imported.rootId];
    assert.ok(root);
    assert.equal(root.width, 200);
    assert.deepEqual(merged.selectedIds, [imported.rootId]);
    assert.equal(merged.nodes[root.id]?.x, 300);
    assert.equal(merged.nodes[root.id]?.y, 250);
    assert.ok((merged.childOrder[EDITOR_ROOT_KEY] ?? []).includes(imported.rootId));
  });

  it("readSvg loads file text", async () => {
    const file = new File(['<svg viewBox="0 0 1 1"></svg>'], "t.svg", { type: "image/svg+xml" });
    const text = await readSvg(file);
    assert.match(text, /<svg/);
  });
});
