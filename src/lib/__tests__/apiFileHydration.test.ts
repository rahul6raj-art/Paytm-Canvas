import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editorHrefForApiFile,
  getRouteApiFileId,
  persistSliceFromApiFileDetail,
} from "@/lib/apiFileHydration";
import type { CraftFileDetail } from "@/lib/apiClient";

const minimalDoc = {
  version: 1 as const,
  name: "From API",
  savedAt: "2026-01-01T00:00:00.000Z",
  nodes: {},
  childOrder: { __root__: [] as string[] },
};

describe("apiFileHydration", () => {
  it("getRouteApiFileId parses fileId query param", () => {
    assert.equal(getRouteApiFileId("?fileId=api-file-1"), "api-file-1");
    assert.equal(getRouteApiFileId("?fileId=%20x%20"), "x");
    assert.equal(getRouteApiFileId(""), null);
    assert.equal(getRouteApiFileId("?other=1"), null);
  });

  it("editorHrefForApiFile encodes file id", () => {
    assert.equal(editorHrefForApiFile("api-file-1"), "/editor?fileId=api-file-1");
    assert.equal(editorHrefForApiFile("a b"), "/editor?fileId=a%20b");
  });

  it("persistSliceFromApiFileDetail uses document JSON when valid", () => {
    const detail: CraftFileDetail = {
      id: "f1",
      workspaceId: "ws1",
      name: "Card",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      documentJson: minimalDoc,
    };
    const slice = persistSliceFromApiFileDetail(detail);
    assert.equal(slice.fileName, "Card");
    assert.deepEqual(slice.childOrder, minimalDoc.childOrder);
  });

  it("persistSliceFromApiFileDetail falls back to blank workspace", () => {
    const detail: CraftFileDetail = {
      id: "f2",
      workspaceId: "ws1",
      name: "Empty",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      documentJson: null,
    };
    const slice = persistSliceFromApiFileDetail(detail);
    assert.equal(slice.fileName, "Empty");
    assert.ok(slice.childOrder);
  });
});
