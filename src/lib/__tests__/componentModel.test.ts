import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  componentMatchesSearchQuery,
  filterComponentLibraryGroups,
  groupComponentMasters,
} from "@/lib/componentModel";

function master(partial: Partial<EditorNode> & Pick<EditorNode, "id" | "name">): EditorNode {
  return {
    parentId: null,
    type: "frame",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    isComponent: true,
    componentId: `cmp-${partial.id}`,
    ...partial,
  };
}

describe("component library search", () => {
  it("groups variants and filters by name", () => {
    const masters = [
      master({ id: "a", name: "Button · variant", variantGroupId: "vg1", variantProperties: { Variant: "Primary" } }),
      master({ id: "b", name: "Button · variant", variantGroupId: "vg1", variantProperties: { Variant: "Secondary" } }),
      master({ id: "c", name: "Card" }),
    ];
    const groups = groupComponentMasters(masters);
    assert.equal(groups.length, 2);
    const filtered = filterComponentLibraryGroups(groups, "secondary");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.variants.length, 1);
    assert.equal(filtered[0]!.variants[0]!.id, "b");
  });

  it("matches variant property keys and values", () => {
    const node = master({
      id: "x",
      name: "Chip",
      variantProperties: { State: "Hover" },
    });
    assert.equal(componentMatchesSearchQuery(node, "hover"), true);
    assert.equal(componentMatchesSearchQuery(node, "state"), true);
    assert.equal(componentMatchesSearchQuery(node, "chip"), true);
    assert.equal(componentMatchesSearchQuery(node, "foo"), false);
  });
});
