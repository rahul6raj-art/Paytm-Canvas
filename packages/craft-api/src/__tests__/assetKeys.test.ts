import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAssetPublicUrl,
  buildAssetStorageKey,
  guessMimeFromFileName,
  sanitizeAssetFileName,
} from "../storage/assetKeys.js";

describe("craft-api assetKeys", () => {
  it("buildAssetStorageKey scopes objects under workspace", () => {
    const key = buildAssetStorageKey("ws-paytm-design", "asset-1", "Hero Banner.png");
    assert.equal(key, "workspaces/ws-paytm-design/assets/asset-1/Hero_Banner.png");
  });

  it("sanitizeAssetFileName replaces unsafe characters", () => {
    assert.equal(sanitizeAssetFileName("  my file (1).png  "), "my_file_1_.png");
  });

  it("buildAssetPublicUrl uses path-style bucket URL", () => {
    const url = buildAssetPublicUrl("http://localhost:9000", "craft-assets", "workspaces/ws/a.png");
    assert.equal(url, "http://localhost:9000/craft-assets/workspaces/ws/a.png");
  });

  it("guessMimeFromFileName infers common image types", () => {
    assert.equal(guessMimeFromFileName("photo.JPG"), "image/jpeg");
    assert.equal(guessMimeFromFileName("blob"), "application/octet-stream");
  });
});
