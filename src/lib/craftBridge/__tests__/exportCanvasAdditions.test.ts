import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  buildCanvasAdditionsJsx,
  collectCanvasAdditionLeafIds,
  collectCanvasAdditionRootIds,
  patchCanvasAdditionsIntoReactSource,
} from "../exportCanvasAdditions";
import { patchLinkedReactSourceFromCanvas } from "../patchLinkedReactSource";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

const SOURCE = `
export const PMLMorePage = () => (
  <div className="pml-more">
    <Header title="More" />
  </div>
);
`;

function rect(id: string, parentId: string, x: number, y: number): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: "Rectangle",
    x,
    y,
    width: 120,
    height: 48,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#f87171",
    cornerRadius: 8,
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("exportCanvasAdditions", () => {
  it("collects manual layers under a bridge screen and orphan overlays inside it", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": {
        id: "web-root-1",
        parentId: null,
        type: "frame",
        name: "More",
        x: 80,
        y: 80,
        width: 376,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        manualScreenLayout: true,
      },
      "rect-1": rect("rect-1", "web-root-1", 24, 320),
      "rect-2": rect("rect-2", null, 104, 400),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1", "rect-2"],
      "web-root-1": ["rect-1"],
      "rect-1": [],
      "rect-2": [],
    };

    const roots = collectCanvasAdditionRootIds("web-root-1", nodes, childOrder);
    assert.deepEqual(roots.sort(), ["rect-1", "rect-2"].sort());
  });

  it("builds portable JSX with inline styles for canvas additions", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": {
        id: "web-root-1",
        parentId: null,
        type: "frame",
        name: "More",
        x: 80,
        y: 80,
        width: 376,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      },
      "rect-1": rect("rect-1", "web-root-1", 24, 320),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["rect-1"],
      "rect-1": [],
    };
    const jsx = buildCanvasAdditionsJsx(["rect-1"], "web-root-1", nodes, childOrder, {});
    assert.match(jsx, /data-pc-id="rect-1"/);
    assert.match(jsx, /data-pc-shape="rectangle"/);
    assert.match(jsx, /left:\s*24/);
  });

  it("exports screen-root coordinates when the shape is nested under an imported frame", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": {
        id: "web-root-1",
        parentId: null,
        type: "frame",
        name: "More",
        x: 80,
        y: 80,
        width: 376,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      },
      section: {
        id: "section",
        parentId: "web-root-1",
        type: "frame",
        name: "sh-section",
        x: 16,
        y: 400,
        width: 344,
        height: 200,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      "rect-1": rect("rect-1", "section", 8, 120),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["section"],
      section: ["rect-1"],
      "rect-1": [],
    };
    const jsx = buildCanvasAdditionsJsx(
      ["rect-1"],
      "web-root-1",
      nodes,
      childOrder,
      {},
      "light",
    );
    assert.match(jsx, /top:\s*520/);
    assert.doesNotMatch(jsx, /top:\s*120/);
  });

  it("exports leaf shapes only, skipping manual wrapper frames", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": {
        id: "web-root-1",
        parentId: null,
        type: "frame",
        name: "More",
        x: 80,
        y: 80,
        width: 376,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      },
      "frame-wrap": {
        id: "frame-wrap",
        parentId: "web-root-1",
        type: "frame",
        name: "Div",
        x: 24,
        y: 320,
        width: 120,
        height: 48,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      },
      "rect-1": rect("rect-1", "frame-wrap", 0, 0),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["frame-wrap"],
      "frame-wrap": ["rect-1"],
      "rect-1": [],
    };
    const leaves = collectCanvasAdditionLeafIds("web-root-1", nodes, childOrder);
    assert.deepEqual(leaves, ["rect-1"]);
    const jsx = buildCanvasAdditionsJsx(
      leaves,
      "web-root-1",
      nodes,
      childOrder,
      {},
      "light",
    );
    assert.match(jsx, /data-pc-id="rect-1"/);
    assert.doesNotMatch(jsx, /data-pc-id="frame-wrap"/);
    assert.doesNotMatch(jsx, /border.*#e5e5e5/);
  });

  it("wraps exported additions and sets screen root relative", () => {
    const source = `
export const PMLMorePage = () => (
  <div className="pml-more">
    <Header title="More" />
    <div className="pml-more__scroll">
      <Card />
    </div>
  </div>
);
`;
    const out = patchCanvasAdditionsIntoReactSource(
      source,
      '<div data-pc-id="rect-1" style={{ position: "absolute", left: 24, top: 320, width: 120, height: 48 }} />',
    );
    assert.match(out, /position:\s*"relative"/);
    assert.match(out, /top:\s*320/);
    assert.match(out, /<Header title="More"/);
    assert.doesNotMatch(out, /data-pc-craft-additions/);
  });

  it("additions-only export does not rewrite Header or list props", () => {
    const nodes: Record<string, EditorNode> = {
      header: {
        id: "header",
        parentId: "root",
        type: "text",
        name: "title",
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Broken",
        codeClassName: "header__bar-title",
      },
    };
    const out = patchLinkedReactSourceFromCanvas(SOURCE, nodes, {
      additionsOnly: true,
    });
    assert.match(out, /title="More"/);
    assert.doesNotMatch(out, /title="Broken"/);
  });

  it("exports dual-mode library tokens as CSS variables in canvas additions", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": {
        id: "web-root-1",
        parentId: null,
        type: "frame",
        name: "More",
        x: 80,
        y: 80,
        width: 376,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      },
      "rect-1": {
        ...rect("rect-1", "web-root-1", 24, 320),
        fill: "#f87171",
        fillTokenId: "css-var-surface-level-4",
      },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["rect-1"],
      "rect-1": [],
    };
    const designTokens = {
      "css-var-surface-level-4": {
        id: "css-var-surface-level-4",
        name: "surface-level-4",
        type: "color" as const,
        value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const jsx = buildCanvasAdditionsJsx(
      ["rect-1"],
      "web-root-1",
      nodes,
      childOrder,
      designTokens,
      "light",
    );
    assert.match(jsx, /background:\s*"var\(--surface-level-4\)"/);
    assert.doesNotMatch(jsx, /background:\s*'#f5f5f5'/);
  });

  it("patchLinkedReactSourceFromCanvas injects canvas additions into the screen file", () => {
    const nodes: Record<string, EditorNode> = {
      "web-root-1": {
        id: "web-root-1",
        parentId: null,
        type: "frame",
        name: "More",
        x: 80,
        y: 80,
        width: 376,
        height: 844,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      },
      "rect-1": rect("rect-1", "web-root-1", 24, 320),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["rect-1"],
      "rect-1": [],
    };

    const out = patchLinkedReactSourceFromCanvas(SOURCE, nodes, {
      childOrder,
      designTokens: {},
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
    });
    assert.match(out, /@craft-canvas-additions:start/);
    assert.match(out, /data-pc-id="rect-1"/);

    const again = patchCanvasAdditionsIntoReactSource(out, "");
    assert.match(again, /@craft-canvas-additions:start/);
    assert.doesNotMatch(again, /data-pc-id="rect-1"/);
  });
});
