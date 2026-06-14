import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ApiSyncProvider,
  documentFromApiPayload,
  getActiveApiFileId,
  getActiveApiRevision,
  setActiveApiFileId,
  setActiveApiRevision,
} from "@/lib/apiSyncProvider";
import { createSyncProvider } from "@/lib/syncProvider";
import { resetSyncProviderForTests } from "@/lib/syncProviderSingleton";

const minimalDoc = {
  version: 1 as const,
  name: "Test",
  savedAt: "2026-01-01T00:00:00.000Z",
  nodes: {},
  childOrder: { __root__: [] as string[] },
};

describe("apiSyncProvider", () => {
  it("documentFromApiPayload accepts valid PaytmCraftDocument JSON", () => {
    assert.deepEqual(documentFromApiPayload(minimalDoc), minimalDoc);
    assert.equal(documentFromApiPayload(null), null);
    assert.equal(documentFromApiPayload({ version: 2 }), null);
  });

  it("setActiveApiFileId tracks the active API file session", () => {
    setActiveApiFileId("file-abc");
    assert.equal(getActiveApiFileId(), "file-abc");
    setActiveApiFileId(null);
    assert.equal(getActiveApiFileId(), null);
  });

  it("setActiveApiRevision tracks revision for If-Match saves", () => {
    setActiveApiRevision("7");
    assert.equal(getActiveApiRevision(), "7");
    setActiveApiRevision(null);
    assert.equal(getActiveApiRevision(), null);
    setActiveApiFileId("file-abc");
    setActiveApiRevision("3");
    setActiveApiFileId(null);
    assert.equal(getActiveApiRevision(), null);
  });

  it("createSyncProvider returns ApiSyncProvider in api mode", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = "api";
    resetSyncProviderForTests();
    try {
      const provider = createSyncProvider();
      assert.equal(provider.kind, "api");
      assert.ok(provider instanceof ApiSyncProvider);
    } finally {
      resetSyncProviderForTests();
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = prev;
    }
  });

  it("createSyncProvider returns RemoteSyncProvider in remote mode", () => {
    const prevMode = process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    const prevUrl = process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = "remote";
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL = "https://api.example.com/v1";
    resetSyncProviderForTests();
    try {
      const provider = createSyncProvider();
      assert.equal(provider.kind, "remote");
      assert.equal(typeof provider.loadDocument, "function");
      assert.equal(typeof provider.saveDocument, "function");
    } finally {
      resetSyncProviderForTests();
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = prevMode;
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL = prevUrl;
    }
  });
});
