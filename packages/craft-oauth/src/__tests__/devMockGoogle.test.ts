import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGoogleOAuthDevMockEnabled, readOAuthProvidersStatus } from "@paytm-craft/oauth";

describe("google oauth dev mock", () => {
  it("is disabled unless CRAFT_OAUTH_GOOGLE_DEV_MOCK is set", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevMock = process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK;
    const prevClientId = process.env.GOOGLE_CLIENT_ID;
    const prevClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.NODE_ENV = "development";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK;

    try {
      assert.equal(isGoogleOAuthDevMockEnabled(), false);
      assert.equal(readOAuthProvidersStatus().google, false);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevMock === undefined) delete process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK;
      else process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK = prevMock;
      if (prevClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = prevClientId;
      if (prevClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = prevClientSecret;
    }
  });

  it("enables google provider when dev mock is opted in", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevMock = process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK;
    const prevClientId = process.env.GOOGLE_CLIENT_ID;
    const prevClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.NODE_ENV = "development";
    process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK = "1";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    try {
      assert.equal(isGoogleOAuthDevMockEnabled(), true);
      assert.equal(readOAuthProvidersStatus().google, true);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevMock === undefined) delete process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK;
      else process.env.CRAFT_OAUTH_GOOGLE_DEV_MOCK = prevMock;
      if (prevClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = prevClientId;
      if (prevClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = prevClientSecret;
    }
  });
});
