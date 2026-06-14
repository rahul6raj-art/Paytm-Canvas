import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_TOKEN_PREFIX,
  apiTokenDisplayPrefix,
  isApiTokenFormat,
  newApiTokenSecret,
  parseBearerToken,
} from "../auth/apiTokenFormat.js";
import { computeTokenExpiresAt, parseExpiresInDays } from "../auth/apiTokenExpiry.js";

describe("craft-api apiToken", () => {
  it("parses Bearer authorization header", () => {
    assert.equal(parseBearerToken("Bearer craft_pat_abc"), "craft_pat_abc");
    assert.equal(parseBearerToken("bearer tok"), "tok");
    assert.equal(parseBearerToken(undefined), null);
    assert.equal(parseBearerToken("Basic x"), null);
  });

  it("generates craft_pat_ secrets", () => {
    const token = newApiTokenSecret();
    assert.ok(token.startsWith(API_TOKEN_PREFIX));
    assert.equal(isApiTokenFormat(token), true);
    assert.equal(isApiTokenFormat("craft_sid_abc"), false);
    assert.equal(apiTokenDisplayPrefix(token), token.slice(0, 16));
  });

  it("parses optional token expiry days", () => {
    assert.equal(parseExpiresInDays(30), 30);
    assert.equal(parseExpiresInDays(null), null);
    assert.equal(parseExpiresInDays(0), null);
    assert.equal(parseExpiresInDays(400), null);
    const at = computeTokenExpiresAt(7, Date.parse("2026-01-01T00:00:00.000Z"));
    assert.equal(at?.toISOString(), "2026-01-08T00:00:00.000Z");
  });
});
