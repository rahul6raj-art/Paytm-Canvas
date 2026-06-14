import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockApiStore } from "@/lib/mockApiStore";

describe("mockApiStore revision", () => {
  it("updateFile bumps revision on success", () => {
    const before = mockApiStore.getFile("api-file-paytm-1");
    assert.ok(before);
    const startRevision = before!.revision;

    const result = mockApiStore.updateFile(
      "api-file-paytm-1",
      { documentJson: { version: 1, name: "Updated" } },
      { ifMatch: startRevision },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.row.revision, String(Number(startRevision) + 1));
  });

  it("updateFile rejects stale If-Match with CONFLICT", () => {
    const file = mockApiStore.getFile("api-file-paytm-2");
    assert.ok(file);

    const result = mockApiStore.updateFile(
      "api-file-paytm-2",
      { name: "Renamed" },
      { ifMatch: "0" },
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "CONFLICT");
    assert.equal(result.currentRevision, file!.revision);
  });

  it("updateFile allows save when If-Match is omitted", () => {
    const file = mockApiStore.getFile("api-file-product-1");
    assert.ok(file);
    const result = mockApiStore.updateFile("api-file-product-1", { name: "Checkout v3" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.row.name, "Checkout v3");
    assert.equal(Number(result.row.revision), Number(file!.revision) + 1);
  });
});
