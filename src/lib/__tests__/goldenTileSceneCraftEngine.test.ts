import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import type { EditorNode } from "@/stores/useEditorStore";

type GoldenFixture = {
  rootIds: string[];
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
};

function loadGoldenFixture(): GoldenFixture {
  const path = join(process.cwd(), "fixtures/golden-tile-scene.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as GoldenFixture & { description?: string };
  return {
    rootIds: raw.rootIds,
    nodes: raw.nodes,
    childOrder: raw.childOrder,
  };
}

describe("goldenTileSceneCraftEngine", () => {
  it("maps golden fixture into craft-engine document slice", () => {
    const fixture = loadGoldenFixture();
    const doc = craftEngineDocumentFromStore({
      nodes: fixture.nodes,
      childOrder: fixture.childOrder,
      rootIds: fixture.rootIds,
    });
    assert.deepEqual(doc.rootIds, ["frame-main"]);
    assert.equal(Object.keys(doc.nodes).length, 6);
    assert.ok(doc.nodes["path-curve"]);
    assert.ok(doc.nodes["text-label"]);
    const json = JSON.stringify(doc);
    assert.ok(json.includes("frame-main"));
    assert.ok(json.includes("path-curve"));
  });
});
