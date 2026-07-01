import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDesignTree } from "@/lib/webImport/designNodeBuilder";
import type { DomSnapshotNode } from "@/lib/webImport/types";

function badgeSpan(text: string): DomSnapshotNode {
  return {
    id: "dom-1",
    tagName: "span",
    className: "badge badge--text badge--primary badge--muted",
    text,
    rect: { x: 0, y: 0, width: 72, height: 20 },
    styles: {
      display: "inline-flex",
      color: "rgb(87, 87, 87)",
      fontSize: "11px",
      fontWeight: "500",
      backgroundColor: "rgb(255, 232, 214)",
      borderRadius: "999px",
    },
    children: [],
  };
}

describe("designNodeBuilder badge labels", () => {
  it("keeps chip copy on badge role nodes instead of dropping it", () => {
    const tree = buildDesignTree(badgeSpan("most used"));
    assert.equal(tree.role, "badge");
    assert.equal(tree.text, "most used");
    assert.ok(tree.typography?.fontSize);
  });
});
