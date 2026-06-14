import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { mockApiStore, resetMockApiStoreForTests } from "@/lib/mockApiStore";
import {
  deserializeMockApiStore,
  loadMockApiStoreFromDisk,
  saveMockApiStoreToDisk,
  serializeMockApiStore,
} from "@/lib/mockApiStorePersistence";

describe("mockApiStorePersistence", () => {
  const prevPersist = process.env.PAYTM_CRAFT_MOCK_API_PERSIST;
  const prevFile = process.env.PAYTM_CRAFT_MOCK_API_FILE;
  let tempDir = "";

  afterEach(() => {
    resetMockApiStoreForTests();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
    if (prevPersist === undefined) delete process.env.PAYTM_CRAFT_MOCK_API_PERSIST;
    else process.env.PAYTM_CRAFT_MOCK_API_PERSIST = prevPersist;
    if (prevFile === undefined) delete process.env.PAYTM_CRAFT_MOCK_API_FILE;
    else process.env.PAYTM_CRAFT_MOCK_API_FILE = prevFile;
  });

  it("serialize/deserialize round-trips maps", () => {
    const file = mockApiStore.getFile("api-file-paytm-1");
    assert.ok(file);
    const snapshot = serializeMockApiStore({
      users: [{ id: "u1", email: "a@b.com", displayName: "A" }],
      workspaces: [{ id: "ws1", name: "W", slug: "w" }],
      files: new Map([[file!.id, file!]]),
      comments: new Map(),
      versions: new Map(),
      nextSeq: 42,
    });
    const restored = deserializeMockApiStore(snapshot);
    assert.equal(restored.nextSeq, 42);
    assert.equal(restored.files.get(file!.id)?.name, file!.name);
  });

  it("loadMockApiStoreFromDisk reads saved snapshot", () => {
    tempDir = mkdtempSync(join(tmpdir(), "craft-mock-api-"));
    process.env.PAYTM_CRAFT_MOCK_API_PERSIST = "1";
    process.env.PAYTM_CRAFT_MOCK_API_FILE = join(tempDir, "store.json");

    const now = new Date().toISOString();
    saveMockApiStoreToDisk({
      users: [],
      workspaces: [{ id: "ws-personal", name: "Personal", slug: "personal" }],
      files: [
        {
          id: "api-file-disk-1",
          workspaceId: "ws-personal",
          name: "Persisted draft",
          documentJson: null,
          createdAt: now,
          updatedAt: now,
          revision: "1",
        },
      ],
      comments: [],
      versions: [],
      nextSeq: 10,
    });

    const loaded = loadMockApiStoreFromDisk();
    assert.ok(loaded);
    assert.equal(loaded.files[0]?.name, "Persisted draft");
    const state = deserializeMockApiStore(loaded);
    assert.equal(state.files.get("api-file-disk-1")?.revision, "1");
  });
});
