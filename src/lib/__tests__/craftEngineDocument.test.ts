import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { craftEngineDocumentFromStore } from "@/engine/craftEngineDocument";
import type { EditorAsset, EditorNode } from "@/stores/useEditorStore";

describe("craftEngineDocument", () => {
  it("includes asset summaries for image nodes", () => {
    const nodes: Record<string, EditorNode> = {
      img: {
        id: "img",
        type: "image",
        name: "Photo",
        visible: true,
        locked: false,
        x: 0,
        y: 0,
        width: 200,
        height: 150,
        rotation: 0,
        assetId: "asset-1",
        imageSrc: "data:image/png;base64,abc",
      } as EditorNode,
    };
    const assets: Record<string, EditorAsset> = {
      "asset-1": {
        id: "asset-1",
        name: "Photo",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,abc",
        width: 200,
        height: 150,
      },
    };
    const doc = craftEngineDocumentFromStore({
      nodes,
      childOrder: { __root__: ["img"] },
      assets,
    });
    assert.equal(doc.assets?.["asset-1"]?.width, 200);
    assert.equal(doc.assets?.["asset-1"]?.height, 150);
    assert.ok(doc.assets?.["asset-1"]?.averageColor);
  });
});
