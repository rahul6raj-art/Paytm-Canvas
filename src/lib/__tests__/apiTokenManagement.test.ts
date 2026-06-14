import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiTokenCreatedSuccessMessage,
  formatApiTokenExpiry,
  parseTokenExpiryDaysInput,
} from "@/lib/apiTokenManagement";

describe("apiTokenManagement", () => {
  it("parses expiry preset values", () => {
    assert.equal(parseTokenExpiryDaysInput("none"), null);
    assert.equal(parseTokenExpiryDaysInput("30"), 30);
    assert.equal(parseTokenExpiryDaysInput("400"), undefined);
    assert.equal(parseTokenExpiryDaysInput("abc"), undefined);
  });

  it("formats expiry labels", () => {
    assert.equal(formatApiTokenExpiry(null), "No expiry");
    assert.equal(formatApiTokenExpiry("2020-01-01T00:00:00.000Z", Date.parse("2026-01-01")), "Expired");
    assert.match(formatApiTokenExpiry("2030-06-01T00:00:00.000Z", 0), /2030/);
  });

  it("builds create success copy with token secret", () => {
    const msg = apiTokenCreatedSuccessMessage({
      id: "pat-1",
      name: "CI",
      tokenPrefix: "craft_pat_abc",
      token: "craft_pat_secret",
      scope: "read",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
    });
    assert.match(msg, /Read-only/);
    assert.match(msg, /craft_pat_secret/);
    assert.match(msg, /CRAFT_API_TOKEN/);
  });

  it("formats custom resource scopes", () => {
    const msg = apiTokenCreatedSuccessMessage({
      id: "pat-2",
      name: "Exporter",
      tokenPrefix: "craft_pat_xyz",
      token: "craft_pat_xyz_secret",
      scope: "write",
      resourceScopes: ["files:read", "assets:read"],
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
    });
    assert.match(msg, /Read files/);
    assert.match(msg, /Read assets/);
  });
});
