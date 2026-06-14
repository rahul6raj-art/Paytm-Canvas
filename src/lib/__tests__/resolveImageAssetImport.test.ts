import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { isPaytmCraftRemoteMode } from "@/lib/env";
import { resolveImageAssetFromFile } from "@/lib/resolveImageAssetImport";

describe("resolveImageAssetImport", () => {
  const prevMode = process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
  const prevApi = process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = "local";
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;
  });

  afterEach(() => {
    if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    else process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = prevMode;
    if (prevApi === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;
    else process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL = prevApi;
  });

  it("local mode ignores workspaceId and keeps data URL imports", async () => {
    assert.equal(isPaytmCraftRemoteMode(), false);
    if (typeof FileReader === "undefined") return;

    const file = new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" });
    const asset = await resolveImageAssetFromFile(file, { workspaceId: "ws-paytm-design" });
    assert.equal(asset.dataUrl.startsWith("data:"), true);
  });
});
