import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const memory: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(memory)) delete memory[key];
  const localStorage = {
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => {
      memory[key] = value;
    },
    removeItem: (key: string) => {
      delete memory[key];
    },
    clear: () => {
      for (const key of Object.keys(memory)) delete memory[key];
    },
    key: () => "",
    length: 0,
  };
  (globalThis as typeof globalThis & { window?: { localStorage: typeof localStorage } }).window = {
    localStorage,
  };
});

import {
  getActiveKeyForProvider,
  maskAIKey,
  newAIKeyId,
  removeAIKey,
  saveAIKey,
  setActiveAIKey,
  writeAIKeysStore,
} from "@/lib/aiKeys/storage";

describe("aiKeyStorage", () => {
  it("saves and activates keys per provider", () => {
    writeAIKeysStore({ keys: [], activeByProvider: {} });
    const first = saveAIKey({ provider: "openai", key: "sk-test-one", label: "Work" });
    const second = saveAIKey({ provider: "openai", key: "sk-test-two", label: "Personal" });
    assert.equal(getActiveKeyForProvider("openai")?.id, second.id);
    setActiveAIKey("openai", first.id);
    assert.equal(getActiveKeyForProvider("openai")?.id, first.id);
    removeAIKey(first.id);
    assert.equal(getActiveKeyForProvider("openai")?.id, second.id);
  });

  it("masks keys for display", () => {
    assert.equal(maskAIKey("sk-ant-1234567890"), "sk-a…7890");
  });

  it("generates unique ids", () => {
    assert.notEqual(newAIKeyId(), newAIKeyId());
  });
});
