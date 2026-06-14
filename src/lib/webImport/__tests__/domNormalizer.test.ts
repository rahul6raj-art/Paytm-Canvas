import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomSnapshot } from "../domNormalizer";
import type { DomSnapshotNode } from "../types";

function node(partial: Partial<DomSnapshotNode> & Pick<DomSnapshotNode, "id" | "tagName" | "rect">): DomSnapshotNode {
  return {
    styles: {},
    children: [],
    ...partial,
  };
}

describe("normalizeDomSnapshot input wrappers", () => {
  it("merges styled div wrapper into single input node", () => {
    const root = node({
      id: "form",
      tagName: "div",
      rect: { x: 0, y: 0, width: 400, height: 300 },
      children: [
        node({
          id: "wrap",
          tagName: "div",
          className: "rounded-md border ring-1",
          rect: { x: 0, y: 40, width: 320, height: 40 },
          styles: {
            backgroundColor: "rgb(255, 255, 255)",
            boxShadow: "rgb(209, 213, 219) 0px 0px 0px 1px inset",
            borderRadius: "6px",
            paddingLeft: "12px",
          },
          children: [
            node({
              id: "field",
              tagName: "input",
              rect: { x: 12, y: 48, width: 296, height: 24 },
              styles: { color: "rgb(17, 24, 39)" },
              placeholder: "Enter your email",
            }),
          ],
        }),
      ],
    });

    const out = normalizeDomSnapshot(root);
    assert.equal(out.tagName.toLowerCase(), "input");
    assert.equal(out.placeholder, "Enter your email");
    assert.equal(out.rect.height, 40);
    assert.ok(out.styles.backgroundColor?.includes("255"));
    assert.ok(out.styles.boxShadow?.includes("209"));
  });

  it("keeps form container when it has multiple fields", () => {
    const root = node({
      id: "form",
      tagName: "div",
      className: "space-y-4",
      rect: { x: 0, y: 0, width: 400, height: 200 },
      children: [
        node({
          id: "wrap-a",
          tagName: "div",
          className: "rounded-md border",
          rect: { x: 0, y: 0, width: 320, height: 40 },
          styles: {
            backgroundColor: "rgb(255, 255, 255)",
            boxShadow: "rgb(209, 213, 219) 0px 0px 0px 1px inset",
          },
          children: [
            node({
              id: "field-a",
              tagName: "input",
              rect: { x: 12, y: 8, width: 296, height: 24 },
              placeholder: "Email",
            }),
          ],
        }),
        node({
          id: "wrap-b",
          tagName: "div",
          className: "rounded-md border",
          rect: { x: 0, y: 56, width: 320, height: 40 },
          styles: {
            backgroundColor: "rgb(255, 255, 255)",
            boxShadow: "rgb(209, 213, 219) 0px 0px 0px 1px inset",
          },
          children: [
            node({
              id: "field-b",
              tagName: "input",
              rect: { x: 12, y: 64, width: 296, height: 24 },
              placeholder: "Password",
            }),
          ],
        }),
      ],
    });

    const out = normalizeDomSnapshot(root);
    assert.equal(out.children.length, 2);
    assert.equal(out.children[0]?.tagName.toLowerCase(), "input");
    assert.equal(out.children[1]?.tagName.toLowerCase(), "input");
  });
});
