import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  corsAllowedOrigins,
  isAnonAccessAllowed,
  sessionCookieSecure,
  validateCraftApiConfig,
} from "../config.js";

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

describe("craft-api config", () => {
  it("disables anon when CRAFT_API_ALLOW_ANON=0", () => {
    setEnv("CRAFT_API_ALLOW_ANON", "0");
    assert.equal(isAnonAccessAllowed(), false);
  });

  it("enables secure cookies in production profile", () => {
    setEnv("CRAFT_API_ENV", "production");
    setEnv("CRAFT_API_COOKIE_SECURE", undefined);
    assert.equal(sessionCookieSecure(), true);
  });

  it("parses comma-separated CORS origins", () => {
    setEnv("CRAFT_API_ENV", "production");
    setEnv("CRAFT_API_CORS_ORIGIN", "https://app.example.com, https://staging.example.com");
    const origins = corsAllowedOrigins();
    assert.deepEqual(origins, ["https://app.example.com", "https://staging.example.com"]);
  });

  it("warns when production allows anon", () => {
    setEnv("CRAFT_API_ENV", "production");
    setEnv("CRAFT_API_ALLOW_ANON", "1");
    setEnv("CRAFT_API_CORS_ORIGIN", "https://app.example.com");
    const warnings = validateCraftApiConfig();
    assert.ok(warnings.some((w) => w.includes("ALLOW_ANON")));
  });
});
