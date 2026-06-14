import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resetCraftEngineSyncAfterHistory } from "@/engine/craftEngineHistorySync";
import {
  createCraftEngineSyncState,
  syncCraftEngineDocument,
} from "@/engine/craftEngineIncrementalSync";
import type { CraftEngineDocument, CraftEngineInstance } from "@/engine/craftEngineTypes";

describe("craftEngineHistorySync", () => {
  it("reset forces next sync to be full", () => {
    const syncs: string[] = [];
    const engine = {
      syncDocument(json: string) {
        syncs.push(json);
      },
      loadDocument() {},
      applyDocumentOp() {},
    } as CraftEngineInstance;

    const doc: CraftEngineDocument = {
      rootIds: ["n"],
      childOrder: { __root__: ["n"] },
      nodes: { n: { id: "n", type: "rectangle", x: 0, y: 0, width: 10, height: 10 } },
    };

    const state = createCraftEngineSyncState();
    syncCraftEngineDocument(engine, doc, state);

    const reset = resetCraftEngineSyncAfterHistory(state);
    assert.equal(reset.forceFull, true);
    assert.equal(reset.state.lastDocument, null);

    const next = {
      ...doc,
      nodes: { n: { ...doc.nodes.n, x: 5 } },
    };
    const mode = syncCraftEngineDocument(engine, next, reset.state, {
      forceFull: reset.forceFull,
    });
    assert.equal(mode, "full");
    assert.equal(syncs.length, 2);
  });
});
