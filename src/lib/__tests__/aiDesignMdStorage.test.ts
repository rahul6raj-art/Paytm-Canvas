import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { AIContextAttachment } from "@/lib/aiGenerateContext";
import {
  loadStoredDesignMdUploads,
  loadStoredSelectedDesignMdId,
  normalizeStoredSelection,
  saveStoredDesignMdUploads,
  saveStoredSelectedDesignMdId,
} from "@/lib/aiDesignMdStorage";

const UPLOADS_KEY = "paytm-craft:ai-design-md-uploads";
const SELECTED_KEY = "paytm-craft:ai-design-md-selected";

function mockLocalStorage() {
  const bag = new Map<string, string>();
  const storage = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => {
      bag.set(k, v);
    },
    removeItem: (k: string) => {
      bag.delete(k);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return bag;
}

describe("aiDesignMdStorage", () => {
  beforeEach(() => mockLocalStorage());
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("persists uploads and selection across reloads", () => {
    const ref: AIContextAttachment = {
      id: "ctx-test-1",
      kind: "design-md",
      name: "paytm-design.md",
      size: 1200,
      status: "ready",
      summary: "Design spec colors:\n  brand-primary: \"#00b8f5\"",
    };
    saveStoredDesignMdUploads([ref]);
    saveStoredSelectedDesignMdId(ref.id);

    assert.equal(loadStoredDesignMdUploads().length, 1);
    assert.equal(loadStoredDesignMdUploads()[0]?.name, "paytm-design.md");
    assert.equal(loadStoredSelectedDesignMdId(), ref.id);
    assert.equal(
      normalizeStoredSelection(loadStoredSelectedDesignMdId(), loadStoredDesignMdUploads()),
      ref.id,
    );
  });

  it("ignores builtin ids in upload storage", () => {
    saveStoredDesignMdUploads([
      {
        id: "builtin:paytm",
        kind: "design-md",
        name: "paytm DESIGN.md",
        size: 1,
        status: "ready",
        summary: "should not store",
      },
    ]);
    assert.equal(loadStoredDesignMdUploads().length, 0);
    assert.equal(globalThis.localStorage.getItem(UPLOADS_KEY), "[]");
  });

  it("clears invalid selection when upload removed", () => {
    saveStoredSelectedDesignMdId("ctx-missing");
    assert.equal(normalizeStoredSelection("ctx-missing", []), null);
    void SELECTED_KEY;
  });
});
