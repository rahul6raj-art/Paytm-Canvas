import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exportPageCssFiles,
  reactStyleToCssDeclarations,
  updatePageCssContent,
} from "../exportPageCss";

describe("exportPageCss", () => {
  it("reactStyleToCssDeclarations uses kebab-case", () => {
    const decls = reactStyleToCssDeclarations({
      backgroundColor: "#101010",
      fontSize: 36,
      fontWeight: 700,
    });
    assert.equal(decls["background-color"], "#101010");
    assert.equal(decls["font-size"], "36px");
    assert.equal(decls["font-weight"], "700");
  });

  it("updatePageCssContent merges updates into existing rule block", () => {
    const css = `.hero { color: red; font-size: 12px; border-radius: 8px; }`;
    const out = updatePageCssContent(
      css,
      new Map([[".hero", { color: "#ffffff", "font-size": "36px" }]]),
    );
    assert.match(out, /color: #ffffff/);
    assert.match(out, /font-size: 36px/);
    assert.match(out, /border-radius: 8px/);
    assert.doesNotMatch(out, /color: red/);
  });

  it("exportPageCssFiles updates matching class rules from nodes", () => {
    const original = `
.pml-signup {
  background-color: #000000;
  width: 390px;
}
.pml-signup__hero-title {
  color: #cccccc;
  font-size: 24px;
}
`;
    const nodes = {
      root: {
        id: "root",
        type: "frame" as const,
        name: "signup",
        x: 0,
        y: 0,
        width: 390,
        height: 844,
        codeClassName: "pml-signup",
        fill: "#101010",
        fillEnabled: true,
        visible: true,
        locked: false,
        parentId: null,
      },
      title: {
        id: "title",
        type: "text" as const,
        name: "title",
        x: 24,
        y: 120,
        width: 300,
        height: 48,
        codeClassName: "pml-signup__hero-title",
        content: "Hello",
        textColor: "#ffffff",
        fill: "#ffffff",
        fontSize: 36,
        fontWeight: 700,
        visible: true,
        locked: false,
        parentId: "root",
      },
    };

    const out = exportPageCssFiles({
      nodes: nodes as unknown as Record<string, import("@/stores/useEditorStore").EditorNode>,
      designTokens: {},
      originalCssFiles: [{ path: "PMLSignupPage.css", content: original }],
    });

    assert.equal(out.length, 1);
    assert.match(out[0]!.content, /background: #101010/);
    assert.match(out[0]!.content, /color: #ffffff/);
    assert.match(out[0]!.content, /font-size: 36px/);
  });
});
