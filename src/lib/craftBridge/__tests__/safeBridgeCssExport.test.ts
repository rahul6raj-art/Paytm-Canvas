import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exportPageCssFiles,
  filterBridgeSafeCssDeclarations,
} from "@/lib/codeRoundTrip/exportPageCss";
import {
  exportSafeBridgePageCss,
  isBridgeScreenLocalCssPath,
} from "@/lib/craftBridge/safeBridgeCssExport";
import type { EditorNode } from "@/stores/useEditorStore";

describe("filterBridgeSafeCssDeclarations", () => {
  it("does not sync layout spacing props from canvas", () => {
    const filtered = filterBridgeSafeCssDeclarations({
      color: "#111",
      "background-color": "#f5f5f5",
      "border-radius": "12px",
      gap: "16px",
      padding: "12px 16px",
      "padding-top": "8px",
      position: "absolute",
      width: "376px",
      height: "44px",
    });
    assert.deepEqual(filtered, {
      color: "#111",
      "background-color": "#f5f5f5",
      "border-radius": "12px",
    });
  });
});

describe("isBridgeScreenLocalCssPath", () => {
  it("allows screen css and rejects token files", () => {
    const tsx = "src/screens/PMLMorePage/PMLMorePage.tsx";
    assert.equal(
      isBridgeScreenLocalCssPath(tsx, "src/screens/PMLMorePage/PMLMorePage.css"),
      true,
    );
    assert.equal(
      isBridgeScreenLocalCssPath(tsx, "src/tokens/typography.css"),
      false,
    );
  });
});

describe("exportSafeBridgePageCss", () => {
  it("writes safe visual updates to screen css only", () => {
    const css = `.pml-more-theme-card {
  background-color: #fff;
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
      fill: "#eeeeee",
      cornerRadius: 16,
    };

    const updated = exportSafeBridgePageCss({
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      cssPaths: [
        "src/screens/PMLMorePage/PMLMorePage.css",
        "src/tokens/colors.css",
      ],
      cssFiles: [
        { path: "src/screens/PMLMorePage/PMLMorePage.css", content: css },
        { path: "src/tokens/colors.css", content: ".x { color: red; }" },
      ],
      nodes: { card: node },
      designTokens: {},
    });

    assert.equal(updated.length, 1);
    assert.equal(updated[0]!.path, "src/screens/PMLMorePage/PMLMorePage.css");
    assert.match(updated[0]!.content, /background: #eeeeee/);
    assert.match(updated[0]!.content, /border-radius: 16px/);
    assert.doesNotMatch(updated[0]!.content, /position:/);
    assert.doesNotMatch(updated[0]!.content, /width:/);
  });

  it("does not write inactive bottom nav icon colors to global bn__icon-wrap", () => {
    const css = `.bn__icon-wrap {
  color: var(--icon-neutral-strong);
}
.bn__item--active .bn__icon-wrap {
  color: var(--text-positive-strong);
}
`;
    const mkTab = (id: string, active: boolean, fill: string) => {
      const item: EditorNode = {
        id: `${id}-item`,
        parentId: "bar",
        type: "frame",
        name: id,
        x: 0,
        y: 0,
        width: 72,
        height: 72,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        codeClassName: active ? "bn__item bn__item--active" : "bn__item",
      };
      const wrap: EditorNode = {
        id: `${id}-wrap`,
        parentId: item.id,
        type: "frame",
        name: "icon",
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        codeClassName: "bn__icon-wrap",
      };
      const svg: EditorNode = {
        id: `${id}-svg`,
        parentId: wrap.id,
        type: "frame",
        name: "Svg",
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      };
      const path: EditorNode = {
        id: `${id}-path`,
        parentId: svg.id,
        type: "path",
        name: "Vector",
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill,
        fillEnabled: true,
      };
      return { item, wrap, svg, path };
    };

    const home = mkTab("home", false, "#575757");
    const more = mkTab("more", true, "#34A34D");
    const bar: EditorNode = {
      id: "bar",
      parentId: "root",
      type: "frame",
      name: "bar",
      x: 0,
      y: 0,
      width: 376,
      height: 72,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "bn__bar",
    };

    const updated = exportSafeBridgePageCss({
      sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
      cssPaths: ["src/screens/PMLMorePage/PMLMorePage.css"],
      cssFiles: [{ path: "src/screens/PMLMorePage/PMLMorePage.css", content: css }],
      nodes: {
        bar,
        [home.item.id]: home.item,
        [home.wrap.id]: home.wrap,
        [home.svg.id]: home.svg,
        [home.path.id]: home.path,
        [more.item.id]: more.item,
        [more.wrap.id]: more.wrap,
        [more.svg.id]: more.svg,
        [more.path.id]: more.path,
      },
      designTokens: {},
    });

    assert.equal(updated.length, 1);
    assert.match(updated[0]!.content, /color: var\(--icon-neutral-strong\)/);
    assert.match(updated[0]!.content, /\.bn__item--active \.bn__icon-wrap[\s\S]*color:\s*#34a34d/i);
  });

  it("writes icon path fill as color on nearest icon wrapper class", () => {
    const css = `.pml-home-mood-card__chevron {
  color: var(--icon-neutral-strong);
}
`;
    const chevron: EditorNode = {
      id: "chevron-wrap",
      parentId: "root",
      type: "frame",
      name: "chevron",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "pml-home-mood-card__chevron",
    };
    const svg: EditorNode = {
      id: "svg",
      parentId: "chevron-wrap",
      type: "frame",
      name: "Svg",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    };
    const path: EditorNode = {
      id: "path",
      parentId: "svg",
      type: "path",
      name: "Vector",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#ff5500",
      fillEnabled: true,
    };

    const updated = exportSafeBridgePageCss({
      sourcePath: "src/screens/PMLHomePage/PMLHomePage.tsx",
      cssPaths: ["src/screens/PMLHomePage/PMLHomePage.css"],
      cssFiles: [{ path: "src/screens/PMLHomePage/PMLHomePage.css", content: css }],
      nodes: {
        [chevron.id]: chevron,
        [svg.id]: svg,
        [path.id]: path,
      },
      designTokens: {},
    });

    assert.equal(updated.length, 1);
    assert.match(updated[0]!.content, /color: #ff5500/);
  });

  it("filterDeclarations on exportPageCssFiles strips layout props", () => {
    const node: EditorNode = {
      id: "card",
      parentId: "root",
      type: "frame",
      name: "card",
      x: 16,
      y: 24,
      width: 344,
      height: 76,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      codeClassName: "card",
      fill: "#fff",
    };
    const [file] = exportPageCssFiles({
      nodes: { card: node },
      designTokens: {},
      originalCssFiles: [{ path: "screen.css", content: "" }],
      filterDeclarations: filterBridgeSafeCssDeclarations,
    });
    assert.match(file!.content, /background:/);
    assert.doesNotMatch(file!.content, /position:/);
    assert.doesNotMatch(file!.content, /left:/);
  });
});
