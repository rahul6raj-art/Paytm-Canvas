import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DomSnapshotNode } from "../types";
import { focusDomTreeOnStorybookStoryRoot } from "../storybookDomRoot";

function node(
  partial: Partial<DomSnapshotNode> & Pick<DomSnapshotNode, "id" | "tagName" | "rect">,
  children: DomSnapshotNode[] = [],
): DomSnapshotNode {
  return {
    styles: {},
    children,
    ...partial,
  };
}

describe("focusDomTreeOnStorybookStoryRoot", () => {
  it("re-roots on the button inside Storybook preview chrome", () => {
    const root = node(
      { id: "body", tagName: "body", rect: { x: 0, y: 0, width: 480, height: 240 } },
      [
        node(
          {
            id: "preview",
            tagName: "div",
            className: "sb-pml-preview-canvas",
            rect: { x: 0, y: 0, width: 480, height: 240 },
          },
          [
            node(
              {
                id: "host",
                tagName: "div",
                className: "sb-pml-storybook-phone-host pml-theme-scope",
                rect: { x: 52, y: 0, width: 376, height: 240 },
              },
              [
                node(
                  {
                    id: "btn",
                    tagName: "button",
                    className: "btn btn--filled btn--large",
                    rect: { x: 140, y: 96, width: 200, height: 48 },
                    text: "Filled Button",
                  },
                  [
                    node(
                      {
                        id: "label",
                        tagName: "span",
                        className: "btn__label",
                        rect: { x: 168, y: 110, width: 144, height: 20 },
                        text: "Filled Button",
                      },
                      [],
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );

    const focused = focusDomTreeOnStorybookStoryRoot(root);
    assert.equal(focused.tagName, "button");
    assert.equal(focused.rect.x, 0);
    assert.equal(focused.rect.y, 0);
    assert.equal(focused.rect.width, 200);
    assert.equal(focused.rect.height, 48);
    assert.equal(focused.children[0]?.rect.x, 28);
  });
});
