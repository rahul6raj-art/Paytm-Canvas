import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planIncrementalDocumentOps } from "@/engine/craftEngineIncrementalSync";
import type { CraftEngineDocument } from "@/engine/craftEngineTypes";

function baseDoc(): CraftEngineDocument {
  return {
    rootIds: ["a"],
    childOrder: { __root__: ["a"] },
    nodes: {
      a: { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 80 },
    },
  };
}

describe("craftEngineAuthorityStructure", () => {
  it("plans deleteNode op", () => {
    const prev = baseDoc();
    const next = { rootIds: [] as string[], childOrder: { __root__: [] as string[] }, nodes: {} };
    const plan = planIncrementalDocumentOps(prev, next);
    assert.ok(Array.isArray(plan));
    assert.equal(plan[0]?.op, "deleteNode");
  });

  it("plans insertNode op", () => {
    const prev = baseDoc();
    const next = {
      ...prev,
      rootIds: ["a", "b"],
      childOrder: { __root__: ["a", "b"] },
      nodes: {
        ...prev.nodes,
        b: { id: "b", type: "ellipse", x: 10, y: 10, width: 40, height: 40 },
      },
    };
    const plan = planIncrementalDocumentOps(prev, next);
    assert.ok(Array.isArray(plan));
    assert.equal(plan[0]?.op, "insertNode");
  });

  it("plans setTree for reorder", () => {
    const prev = {
      ...baseDoc(),
      rootIds: ["a", "b"],
      childOrder: { __root__: ["a", "b"] },
      nodes: {
        ...baseDoc().nodes,
        b: { id: "b", type: "rectangle", x: 20, y: 0, width: 50, height: 50 },
      },
    };
    const next = { ...prev, childOrder: { __root__: ["b", "a"] } };
    const plan = planIncrementalDocumentOps(prev, next);
    assert.ok(Array.isArray(plan));
    assert.equal(plan[0]?.op, "setTree");
  });

  it("returns noop for identical docs", () => {
    const doc = baseDoc();
    assert.equal(planIncrementalDocumentOps(doc, doc), "noop");
  });

  it("requires full sync when inserting a group with reparented children (boolean)", () => {
    const prev = {
      rootIds: ["a", "b"],
      childOrder: { __root__: ["a", "b"] },
      nodes: {
        a: { id: "a", type: "rectangle", x: 0, y: 0, width: 80, height: 60 },
        b: { id: "b", type: "rectangle", x: 40, y: 20, width: 80, height: 60 },
      },
    };
    const next = {
      rootIds: ["g"],
      childOrder: { __root__: ["g"], g: ["a", "b"] },
      nodes: {
        g: { id: "g", type: "group", x: 0, y: 0, width: 120, height: 80, isBooleanGroup: true },
        a: { id: "a", type: "rectangle", parentId: "g", x: 0, y: 0, width: 80, height: 60 },
        b: { id: "b", type: "rectangle", parentId: "g", x: 40, y: 20, width: 80, height: 60 },
      },
    };
    assert.equal(planIncrementalDocumentOps(prev, next), "full");
  });
});
