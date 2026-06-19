import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifySyncConflict,
  shouldAutoImportFromSource,
  shouldSurfaceConflict,
} from "../conflict";

describe("craftBridge conflict", () => {
  it("returns none when source matches last import", () => {
    const k = classifySyncConflict({
      sourceHash: "aaa",
      lastImportedHash: "aaa",
      lastExportedHash: "aaa",
      canvasExportHash: "aaa",
    });
    assert.equal(k, "none");
  });

  it("returns source-only when only source changed", () => {
    const k = classifySyncConflict({
      sourceHash: "bbb",
      lastImportedHash: "aaa",
      lastExportedHash: "aaa",
      canvasExportHash: "aaa",
    });
    assert.equal(k, "source-only");
    assert.equal(shouldAutoImportFromSource(k, "ask"), true);
  });

  it("returns both when source and canvas diverged", () => {
    const k = classifySyncConflict({
      sourceHash: "bbb",
      lastImportedHash: "aaa",
      lastExportedHash: "aaa",
      canvasExportHash: "ccc",
    });
    assert.equal(k, "both");
    assert.equal(shouldAutoImportFromSource(k, "ask"), false);
    assert.equal(shouldSurfaceConflict(k, "ask"), true);
    assert.equal(shouldAutoImportFromSource(k, "source-wins"), true);
    assert.equal(shouldAutoImportFromSource(k, "canvas-wins"), false);
  });
});
