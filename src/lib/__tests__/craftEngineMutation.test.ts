import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCraftEngineAccessActive,
  readCraftEngine,
  runCraftEngineAccess,
} from "@/engine/craftEngineMutation";

describe("runCraftEngineAccess", () => {
  it("runs sync access sequentially", () => {
    const order: number[] = [];
    runCraftEngineAccess(() => order.push(1));
    runCraftEngineAccess(() => order.push(2));
    assert.deepEqual(order, [1, 2]);
  });

  it("defers nested access until the outer call completes", () => {
    const order: string[] = [];
    runCraftEngineAccess(() => {
      order.push("outer-start");
      runCraftEngineAccess(() => order.push("nested"));
      order.push("outer-end");
    });
    assert.deepEqual(order, ["outer-start", "outer-end", "nested"]);
    assert.equal(isCraftEngineAccessActive(), false);
  });

  it("flushes multiple deferred access calls after re-entrancy", () => {
    const order: number[] = [];
    runCraftEngineAccess(() => {
      order.push(1);
      runCraftEngineAccess(() => order.push(2));
      runCraftEngineAccess(() => order.push(3));
    });
    assert.deepEqual(order, [1, 2, 3]);
  });

  it("readCraftEngine returns fallback while access is active", () => {
    runCraftEngineAccess(() => {
      assert.equal(readCraftEngine(() => "ok", "busy"), "busy");
    });
  });
});
