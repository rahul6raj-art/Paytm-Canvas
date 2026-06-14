import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPaytmCraftPublicEnv,
  isPaytmCraftApiMode,
  isPaytmCraftHttpApiMode,
  isPaytmCraftRealtimeEnabled,
  isPaytmCraftRemoteMode,
} from "@/lib/env";

describe("paytmCraft public env modes", () => {
  it("defaults to local mode", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    try {
      assert.equal(getPaytmCraftPublicEnv().mode, "local");
      assert.equal(isPaytmCraftApiMode(), false);
      assert.equal(isPaytmCraftHttpApiMode(), false);
      assert.equal(isPaytmCraftRemoteMode(), false);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = prev;
    }
  });

  it("api mode enables http api helpers", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = "api";
    try {
      assert.equal(getPaytmCraftPublicEnv().mode, "api");
      assert.equal(isPaytmCraftApiMode(), true);
      assert.equal(isPaytmCraftHttpApiMode(), true);
      assert.equal(isPaytmCraftRemoteMode(), false);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = prev;
    }
  });

  it("remote mode enables http api helpers but not mock api mode", () => {
    const prevMode = process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
    const prevUrl = process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = "remote";
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL = "https://api.example.com/v1";
    try {
      assert.equal(getPaytmCraftPublicEnv().mode, "remote");
      assert.equal(getPaytmCraftPublicEnv().apiUrl, "https://api.example.com/v1");
      assert.equal(isPaytmCraftApiMode(), false);
      assert.equal(isPaytmCraftHttpApiMode(), true);
      assert.equal(isPaytmCraftRemoteMode(), true);
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_MODE = prevMode;
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_API_URL = prevUrl;
    }
  });

  it("isPaytmCraftRealtimeEnabled when sync URL is set", () => {
    const prev = process.env.NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL;
    process.env.NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL = "ws://localhost:3001/yjs";
    try {
      assert.equal(isPaytmCraftRealtimeEnabled(), true);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL;
      else process.env.NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL = prev;
    }
  });
});
