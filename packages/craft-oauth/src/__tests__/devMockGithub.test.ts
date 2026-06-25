import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGithubOAuthDevMockEnabled, readOAuthProvidersStatus } from "@paytm-craft/oauth";

describe("github oauth dev mock", () => {
  it("is disabled unless CRAFT_OAUTH_GITHUB_DEV_MOCK is set", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevMock = process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK;
    const prevClientId = process.env.GITHUB_CLIENT_ID;
    const prevClientSecret = process.env.GITHUB_CLIENT_SECRET;
    process.env.NODE_ENV = "development";
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK;

    try {
      assert.equal(isGithubOAuthDevMockEnabled(), false);
      assert.equal(readOAuthProvidersStatus().github, false);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevMock === undefined) delete process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK;
      else process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK = prevMock;
      if (prevClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
      else process.env.GITHUB_CLIENT_ID = prevClientId;
      if (prevClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
      else process.env.GITHUB_CLIENT_SECRET = prevClientSecret;
    }
  });

  it("enables github provider when dev mock is opted in", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevMock = process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK;
    const prevClientId = process.env.GITHUB_CLIENT_ID;
    const prevClientSecret = process.env.GITHUB_CLIENT_SECRET;
    process.env.NODE_ENV = "development";
    process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK = "1";
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    try {
      assert.equal(isGithubOAuthDevMockEnabled(), true);
      assert.equal(readOAuthProvidersStatus().github, true);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevMock === undefined) delete process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK;
      else process.env.CRAFT_OAUTH_GITHUB_DEV_MOCK = prevMock;
      if (prevClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
      else process.env.GITHUB_CLIENT_ID = prevClientId;
      if (prevClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
      else process.env.GITHUB_CLIENT_SECRET = prevClientSecret;
    }
  });
});
