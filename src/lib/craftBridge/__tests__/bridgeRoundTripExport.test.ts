import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildSemanticBridgeExportBundle } from "../bridgeRoundTripExport";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { DesignToken } from "@/lib/designTokens";

const SOURCE = `
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";

export const PMLMorePage = () => (
  <div className="pml-more">
    <Header title="More" />
    <Card className="pml-more-theme-card" />
  </div>
);
`;

const SURFACE_TOKEN: DesignToken = {
  id: "css-var-surface-level-4",
  name: "surface-level-4",
  type: "color",
  value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
  createdAt: "",
  updatedAt: "",
};

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
    fill: "#dbeafe",
    fillTokenId: "css-var-surface-level-4",
    cornerRadius: 8,
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
}

describe("buildSemanticBridgeExportBundle", () => {
  it("exports theme-safe shape tokens and preserves CSS var() theme styles", async () => {
    const css = `.pml-more-theme-card {
  background: var(--surface-level-4);
}
`;
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
      card: {
        id: "card",
        parentId: "web-root-1",
        type: "frame",
        name: "card",
        x: 16,
        y: 120,
        width: 344,
        height: 76,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        codeClassName: "pml-more-theme-card",
        fill: "#101010",
        fillTokenId: "css-var-surface-level-4",
      },
      "rect-1": rect("rect-1", "web-root-1", 24, 320),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["web-root-1"],
      "web-root-1": ["card", "rect-1"],
      card: [],
      "rect-1": [],
    };

    const bundle = await buildSemanticBridgeExportBundle({
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      cssPaths: ["src/screens/PMLMorePage/PMLMorePage.css"],
      sourceContent: SOURCE,
      cssFiles: [{ path: "src/screens/PMLMorePage/PMLMorePage.css", content: css }],
      nodes,
      childOrder,
      designTokens: { [SURFACE_TOKEN.id]: SURFACE_TOKEN },
      assets: {},
      link: {
        repoRoot: "/repo",
        sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        previewUrl: "http://localhost:5173/?screen=more",
        cssPaths: ["src/screens/PMLMorePage/PMLMorePage.css"],
      },
      fileName: "PMLMorePage",
    });

    assert.match(bundle.tsx, /<Header title="More"/);
    assert.match(bundle.tsx, /background:\s*"var\(--surface-level-4\)"/);
    assert.match(bundle.tsx, /@craft-canvas-additions:start/);
    assert.equal(bundle.cssFiles.length, 0);
    assert.doesNotMatch(bundle.tsx, /data-pc-type="frame"/);
  });
});
