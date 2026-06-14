import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  craftEngineHitTest,
  isCraftEngineReady,
  registerCraftEngine,
} from "@/engine/craftEngineRegistry";
import type { CraftEngineInstance } from "@/engine/craftEngineTypes";

describe("craftEngineRegistry", () => {
  it("returns undefined when no engine is registered", () => {
    registerCraftEngine(null);
    assert.equal(isCraftEngineReady(), false);
    assert.equal(craftEngineHitTest(10, 20), undefined);
  });

  it("delegates hitTest to the active engine", () => {
    const engine = {
      hitTest(worldX: number, worldY: number) {
        return worldX === 50 && worldY === 60 ? "node-a" : undefined;
      },
    } as CraftEngineInstance;

    registerCraftEngine(engine);
    assert.equal(isCraftEngineReady(), true);
    assert.equal(craftEngineHitTest(50, 60), "node-a");
    assert.equal(craftEngineHitTest(0, 0), undefined);
    registerCraftEngine(null);
  });
});
