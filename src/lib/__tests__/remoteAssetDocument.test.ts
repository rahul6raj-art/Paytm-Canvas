import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePaytmCraftDocument } from "@/lib/documentPersistence";

describe("documentPersistence remote assets", () => {
  it("validatePaytmCraftDocument accepts http asset URLs", () => {
    const doc = {
      version: 1,
      name: "Test",
      savedAt: new Date().toISOString(),
      nodes: {},
      childOrder: { __root__: [] },
      assets: {
        a1: {
          id: "a1",
          name: "hero.png",
          mimeType: "image/png",
          dataUrl: "http://localhost:9000/craft-assets/workspaces/ws/a1/hero.png",
          createdAt: new Date().toISOString(),
        },
      },
    };
    assert.equal(validatePaytmCraftDocument(doc), true);
  });
});
