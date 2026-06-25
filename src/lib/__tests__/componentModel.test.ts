import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  canCreateComponentFromSelection,
  componentMatchesSearchQuery,
  filterComponentLibraryGroups,
  findInstanceRoot,
  groupComponentMasters,
  libraryPanelMasters,
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

  it("uses component set container name when nodes are provided", () => {
    const setId = "set-1";
    const a = master({
      id: "a",
      name: "Rectangle 1",
      parentId: setId,
      variantGroupId: "vg1",
      variantProperties: { Variant: "Default" },
    });
    const b = master({
      id: "b",
      name: "Rectangle 2",
      parentId: setId,
      variantGroupId: "vg1",
      variantProperties: { Variant: "Alt" },
    });
    const masters = [a, b];
    const nodes: Record<string, EditorNode> = {
      [setId]: {
        ...master({ id: setId, name: "Component 1" }),
        isComponent: false,
        isComponentSet: true,
        variantGroupId: "vg1",
      },
      a,
      b,
    };
    const groups = groupComponentMasters(masters, nodes);
    assert.equal(groups.find((g) => g.id === "vg1")!.label, "Component 1");
  });

  it("libraryPanelMasters returns one entry per variant set", () => {
    const masters = [
      master({ id: "a", name: "Button · variant", variantGroupId: "vg1", variantProperties: { Variant: "Primary" } }),
      master({ id: "b", name: "Button · variant", variantGroupId: "vg1", variantProperties: { Variant: "Secondary" } }),
      master({ id: "c", name: "Card" }),
    ];
    const panel = libraryPanelMasters(masters);
    assert.equal(panel.length, 2);
    assert.deepEqual(
      panel.map((m) => m.id),
      ["a", "c"],
    );
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

describe("findInstanceRoot", () => {
  it("returns null when the parent chain is broken", () => {
    const nodes: Record<string, EditorNode> = {
      child: {
        ...master({ id: "child", name: "Child" }),
        parentId: "missing-parent",
      },
    };
    assert.equal(findInstanceRoot(nodes, "child"), null);
    assert.equal(findInstanceRoot(nodes, "also-missing"), null);
  });
});

describe("canCreateComponentFromSelection", () => {
  it("does not throw when selection references missing nodes", () => {
    const nodes: Record<string, EditorNode> = {
      frame: master({ id: "frame", name: "Frame" }),
    };
    assert.equal(canCreateComponentFromSelection(["frame", "ghost-id"], nodes), false);
  });
});
