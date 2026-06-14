import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pickDeepestNodeAtWorldPoint } from "@/lib/tree";
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

describe("goldenTileSceneHit", () => {
  it("TS pick matches golden fixture expectations (store DFS path)", () => {
    const fixture = loadGoldenFixture();
    assert.equal(
      pickDeepestNodeAtWorldPoint(200, 150, fixture.nodes, fixture.childOrder),
      "rect-fill",
    );
    assert.equal(
      pickDeepestNodeAtWorldPoint(110, 110, fixture.nodes, fixture.childOrder),
      "frame-main",
    );
  });
});
