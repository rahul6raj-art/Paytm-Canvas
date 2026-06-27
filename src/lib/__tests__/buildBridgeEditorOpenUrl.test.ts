import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBridgeEditorOpenUrl } from "@/lib/craftBridge/buildBridgeEditorOpenUrl";

describe("buildBridgeEditorOpenUrl", () => {
  it("includes bridgeImport and bridgeId query params", () => {
    const url = buildBridgeEditorOpenUrl("bridge-abc123");
    assert.match(url, /^\/editor\?bridgeImport=1&bridgeId=/);
    assert.match(url, /bridgeId=bridge-abc123$/);
  });

  it("encodes special characters in pending ids", () => {
    const url = buildBridgeEditorOpenUrl("bridge/page id");
    assert.ok(url.includes("bridgeId=bridge%2Fpage%20id"));
  });
});
