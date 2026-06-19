import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  removeRootSubtree,
  resolveBridgeImportStrategy,
  screenLabelFromSourcePath,
} from "../bridgeImportStrategy";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

function frame(id: string, opts?: Partial<EditorNode>): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 80,
    y: 80,
    width: 376,
    height: 844,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...opts,
  };
}

describe("resolveBridgeImportStrategy", () => {
  it("replaces when the canvas has no root frames", () => {
    assert.deepEqual(
      resolveBridgeImportStrategy(
        { childOrder: { [EDITOR_ROOT_KEY]: [] }, nodes: {} },
        "src/screens/PMLMorePage/PMLMorePage.tsx",
      ),
      { mode: "replace" },
    );
  });

  it("appends when importing a different screen", () => {
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["more"] },
          nodes: {
            more: frame("more", {
              name: "PMLMorePage",
              bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
            }),
          },
        },
        "src/screens/PMLSignupPage/PMLSignupPage.tsx",
      ),
      { mode: "append" },
    );
  });

  it("replaces an existing artboard when the same source is pushed again", () => {
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["more"] },
          nodes: {
            more: frame("more", {
              name: "PMLMorePage",
              bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
              x: 120,
              y: 64,
            }),
          },
        },
        "src/screens/PMLMorePage/PMLMorePage.tsx",
      ),
      { mode: "replace-root", rootId: "more", x: 120, y: 64 },
    );
  });

  it("matches by screen label when bridgeSourcePath is missing", () => {
    assert.equal(
      screenLabelFromSourcePath("src/screens/PMLMorePage/PMLMorePage.tsx"),
      "PMLMorePage",
    );
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["more"] },
          nodes: { more: frame("more", { name: "PMLMorePage", x: 80, y: 80 }) },
        },
        "src/screens/PMLMorePage/PMLMorePage.tsx",
      ),
      { mode: "replace-root", rootId: "more", x: 80, y: 80 },
    );
  });
});

describe("removeRootSubtree", () => {
  it("removes a root frame and its descendants", () => {
    const nodes = {
      root: frame("root"),
      child: { ...frame("child"), parentId: "root" },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["child"],
    };
    const cleaned = removeRootSubtree(nodes, childOrder, "root");
    assert.deepEqual(cleaned.childOrder[EDITOR_ROOT_KEY], []);
    assert.equal(cleaned.nodes.root, undefined);
    assert.equal(cleaned.nodes.child, undefined);
  });
});
