import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatImportToast } from "@/lib/figImport/figImportSummary";

describe("formatImportToast", () => {
  it("formats success without warning", () => {
    const msg = formatImportToast({
      layerCount: 292,
      rootCount: 12,
      fileName: "Test",
    });
    assert.match(msg, /Test/);
    assert.match(msg, /12 frame/);
    assert.match(msg, /292 layer/);
    assert.equal(msg.includes("not saved"), false);
  });

  it("includes warning when present", () => {
    const msg = formatImportToast({
      layerCount: 100,
      rootCount: 1,
      fileName: "Big",
      warning: "not saved to browser storage",
    });
    assert.match(msg, /not saved/);
  });
});
