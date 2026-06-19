import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DomSnapshotNode } from "@/lib/webImport/types";
import { focusDomTreeOnReactScreenRoot } from "../reactPreviewDomRoot";
import {
  isPhoneShellBottomChrome,
  pinPhoneShellBottomChromeNodes,
} from "../phoneShellBottomChrome";
import { applyPhoneShellFullPageLayout } from "../phoneShellViewport";
import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

function node(partial: Partial<DomSnapshotNode> & Pick<DomSnapshotNode, "id" | "tagName" | "rect">): DomSnapshotNode {
  return {
    styles: {},
    children: [],
    ...partial,
  };
}

function editorFrame(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    type: "frame",
    name: partial.id,
    x: 0,
    y: 0,
    width: 376,
    height: 88,
    parentId: "shell",
    visible: true,
    locked: false,
    expanded: true,
    rotation: 0,
    ...partial,
  };
}

describe("phoneShell full-page layout", () => {
  it("expands phone shell and scroll to include below-the-fold sections", () => {
    const root = node({
      id: "body",
      tagName: "body",
      rect: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        node({
          id: "home",
          tagName: "div",
          className: "pml-home",
          rect: { x: 7, y: 0, width: 376, height: 844 },
          children: [
            node({
              id: "scroll",
              tagName: "div",
              className: "pml-home__scroll",
              rect: { x: 7, y: 145, width: 376, height: 569 },
              children: [
                node({
                  id: "section-b",
                  tagName: "section",
                  className: "pml-home-section",
                  rect: { x: 7, y: 1180, width: 376, height: 480 },
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const focused = focusDomTreeOnReactScreenRoot(root, { width: 390, height: 844 });
    assert.ok(focused.rect.height > 844);
    const scroll = focused.children.find((c) => c.className?.includes("pml-home__scroll"));
    assert.ok(scroll);
    assert.ok((scroll?.rect.height ?? 0) > 569);
  });

  it("applyPhoneShellFullPageLayout keeps full scroll height without clipping", () => {
    const nodes: Record<string, EditorNode> = {
      root: editorFrame({
        id: "root",
        parentId: null,
        codeClassName: "pml-home",
        height: 2600,
        width: 376,
      }),
      scroll: editorFrame({
        id: "scroll",
        parentId: "root",
        codeClassName: "pml-home__scroll",
        height: 2400,
        y: 145,
        clipChildren: true,
      }),
    };
    const childOrder: Record<string, string[]> = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["scroll"],
      scroll: [],
    };

    applyPhoneShellFullPageLayout(nodes, childOrder, 376, 844);

    assert.equal(nodes.root?.height, 2600);
    assert.equal(nodes.root?.clipChildren, false);
    assert.equal(nodes.scroll?.clipChildren, false);
    assert.equal(nodes.scroll?.height, 2400);
  });
});

describe("phoneShellBottomChrome", () => {
  it("detects bottom nav wrappers and components", () => {
    assert.equal(isPhoneShellBottomChrome("pml-home__bottom-nav"), true);
    assert.equal(isPhoneShellBottomChrome("pml-signup__home-indicator"), true);
    assert.equal(isPhoneShellBottomChrome(undefined, "BottomNav"), true);
    assert.equal(isPhoneShellBottomChrome("pml-home__scroll"), false);
  });

  it("pins editor nodes to the bottom of the expanded shell", () => {
    const nodes: Record<string, EditorNode> = {
      shell: editorFrame({
        id: "shell",
        parentId: null,
        codeClassName: "pml-home",
        height: 2600,
        width: 376,
      }),
      nav: editorFrame({
        id: "nav",
        codeClassName: "pml-home__bottom-nav",
        y: 2500,
        height: 88,
      }),
    };
    const childOrder: Record<string, string[]> = {
      shell: ["nav"],
      nav: [],
    };

    pinPhoneShellBottomChromeNodes(nodes, childOrder, 844);

    assert.equal(nodes.nav!.y, 2600 - 88);
  });
});

describe("focusDomTreeOnReactScreenRoot", () => {
  it("re-roots centered pml-signup column to viewport origin", () => {
    const root = node({
      id: "body",
      tagName: "body",
      rect: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        node({
          id: "signup",
          tagName: "div",
          className: "pml-signup",
          rect: { x: 7, y: 0, width: 376, height: 844 },
          children: [
            node({
              id: "title",
              tagName: "h1",
              text: "Create your account",
              rect: { x: 23, y: 120, width: 344, height: 80 },
            }),
          ],
        }),
      ],
    });

    const focused = focusDomTreeOnReactScreenRoot(root, { width: 390, height: 844 });
    assert.equal(focused.className, "pml-signup");
    assert.deepEqual(focused.rect, { x: 0, y: 0, width: 376, height: 844 });
    assert.equal(focused.children[0]?.rect.x, 16);
    assert.equal(focused.children[0]?.rect.y, 120);
  });
});
