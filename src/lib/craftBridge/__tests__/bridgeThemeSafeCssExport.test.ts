import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportSafeBridgePageCss } from "@/lib/craftBridge/safeBridgeCssExport";
import {
  bridgeThemeSafeFillExportValue,
  stripBridgeThemeSensitiveCssColors,
} from "@/lib/craftBridge/bridgeThemeSafeCssExport";
import type { DesignToken } from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";

const SURFACE_TOKEN: DesignToken = {
  id: "css-var-surface-level-4",
  name: "surface-level-4",
  type: "color",
  value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
  createdAt: "",
  updatedAt: "",
};

describe("stripBridgeThemeSensitiveCssColors", () => {
  it("drops baked background when original CSS uses var()", () => {
    const node: EditorNode = {
      id: "card",
      parentId: "root",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 344,
      height: 76,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "pml-more-theme-card",
      fill: "#101010",
      fillTokenId: "css-var-surface-level-4",
    };

    const out = stripBridgeThemeSensitiveCssColors(
      node,
      { background: "#101010", "border-radius": "16px" },
      {
        designTokens: { [SURFACE_TOKEN.id]: SURFACE_TOKEN },
        cssSources: [".pml-more-theme-card { background: var(--surface-level-4); }"],
        matchedRule: {
          selector: ".pml-more-theme-card",
          classes: ["pml-more-theme-card"],
          declarations: { background: "var(--surface-level-4)" },
        },
        canvasColorMode: "dark",
      },
    );

    assert.deepEqual(out, { "border-radius": "16px" });
  });
});

describe("exportSafeBridgePageCss theme preservation", () => {
  it("does not overwrite var() backgrounds after dark-mode capture", () => {
    const css = `.pml-more-theme-card {
  background: var(--surface-level-4);
  border-radius: 8px;
}
`;
    const node: EditorNode = {
      id: "card",
      parentId: "root",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 344,
      height: 76,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "pml-more-theme-card",
      fill: "#101010",
      fillTokenId: "css-var-surface-level-4",
      cornerRadius: 16,
    };

    const updated = exportSafeBridgePageCss({
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      cssPaths: ["src/screens/PMLMorePage/PMLMorePage.css"],
      cssFiles: [{ path: "src/screens/PMLMorePage/PMLMorePage.css", content: css }],
      nodes: { card: node },
      designTokens: { [SURFACE_TOKEN.id]: SURFACE_TOKEN },
      canvasColorMode: "dark",
    });

    assert.equal(updated.length, 1);
    assert.match(updated[0]!.content, /var\(--surface-level-4\)/);
    assert.match(updated[0]!.content, /border-radius: 16px/);
    assert.doesNotMatch(updated[0]!.content, /background:\s*#101010/i);
  });

  it("still exports explicit non-token color edits", () => {
    const css = `.pml-more-theme-card {
  background: var(--surface-level-4);
}
`;
    const node: EditorNode = {
      id: "card",
      parentId: "root",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 344,
      height: 76,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "pml-more-theme-card",
      fill: "#ff5500",
      cornerRadius: 12,
    };

    const updated = exportSafeBridgePageCss({
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      cssPaths: ["src/screens/PMLMorePage/PMLMorePage.css"],
      cssFiles: [{ path: "src/screens/PMLMorePage/PMLMorePage.css", content: css }],
      nodes: { card: node },
      designTokens: { [SURFACE_TOKEN.id]: SURFACE_TOKEN },
      canvasColorMode: "dark",
    });

    assert.equal(updated.length, 1);
    assert.match(updated[0]!.content, /background: #ff5500/i);
    assert.doesNotMatch(updated[0]!.content, /var\(--surface-level-4\)/);
  });
});

describe("bridgeThemeSafe inline export", () => {
  it("exports fillTokenId as CSS var for canvas-added shapes", () => {
    const node: EditorNode = {
      id: "rect-1",
      parentId: "root",
      type: "rectangle",
      name: "Rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 48,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#f87171",
      fillTokenId: "css-var-surface-level-4",
      fillEnabled: true,
      fillOpacity: 1,
      strokePosition: "center",
    };

    const out = bridgeThemeSafeFillExportValue(
      node,
      { [SURFACE_TOKEN.id]: SURFACE_TOKEN },
      "dark",
    );
    assert.equal(out, "var(--surface-level-4)");
  });

  it("exports fillTokenId as CSS var even when fill hex was not resynced on apply", () => {
    const node: EditorNode = {
      id: "rect-1",
      parentId: "root",
      type: "rectangle",
      name: "Rectangle",
      x: 0,
      y: 0,
      width: 120,
      height: 48,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#dbeafe",
      fillTokenId: "css-var-surface-level-4",
      fillEnabled: true,
      fillOpacity: 1,
      strokePosition: "center",
    };

    const out = bridgeThemeSafeFillExportValue(
      node,
      { [SURFACE_TOKEN.id]: SURFACE_TOKEN },
      "light",
    );
    assert.equal(out, "var(--surface-level-4)");
  });
});
