import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isSyncAnonAllowed, validateCraftSyncConfig } from "../config.js";

const saved: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("craft-realtime config", () => {
  it("requires session when CRAFT_SYNC_ALLOW_ANON=0", () => {
    setEnv("CRAFT_SYNC_ALLOW_ANON", "0");
    assert.equal(isSyncAnonAllowed(), false);
  });

  it("warns when production allows anon sync", () => {
    setEnv("CRAFT_SYNC_ENV", "production");
    setEnv("CRAFT_SYNC_ALLOW_ANON", "1");
    const warnings = validateCraftSyncConfig();
    assert.ok(warnings.some((w) => w.includes("ALLOW_ANON")));
  });
});
