import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CRAFT_API_AUTH_ROUTE_MARKERS,
  CRAFT_API_TOKEN_ROUTE_MARKERS,
  CRAFT_API_V1_ROUTE_MARKERS,
  MOCK_V1_ROUTE_FILES,
} from "@/lib/apiContractManifest";
import { isV1ErrorEnvelope, parseV1Data, parseV1Error } from "@/lib/apiEnvelope";

const root = process.cwd();

describe("apiContracts", () => {
  it("parses v1 success and error envelopes", () => {
    const data = parseV1Data<{ id: string }>({ data: { id: "file-1" } });
    assert.equal(data.id, "file-1");
    assert.throws(() => parseV1Data({ error: { code: "FORBIDDEN", message: "nope" } }));
    const err = parseV1Error({ error: { code: "CONFLICT", message: "stale revision" } });
    assert.equal(err.code, "CONFLICT");
    assert.equal(isV1ErrorEnvelope({ error: { code: "X", message: "y" } }), true);
    assert.equal(isV1ErrorEnvelope({ data: {} }), false);
  });

  it("mock /api/v1 route handlers exist", () => {
    for (const rel of MOCK_V1_ROUTE_FILES) {
      assert.ok(existsSync(join(root, rel)), `missing mock route ${rel}`);
    }
  });

  it("craft-api v1 routes match contract manifest", () => {
    const v1Src = readFileSync(join(root, "packages/craft-api/src/routes/v1.ts"), "utf8");
    for (const marker of CRAFT_API_V1_ROUTE_MARKERS) {
      assert.match(v1Src, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("craft-api auth and token routes match contract manifest", () => {
    const authSrc = readFileSync(join(root, "packages/craft-api/src/routes/auth.ts"), "utf8");
    for (const marker of CRAFT_API_AUTH_ROUTE_MARKERS) {
      assert.match(authSrc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    const tokenSrc = readFileSync(join(root, "packages/craft-api/src/routes/apiTokens.ts"), "utf8");
    for (const marker of CRAFT_API_TOKEN_ROUTE_MARKERS) {
      assert.match(tokenSrc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("architecture docs no longer marked as planned-only", () => {
    const apiContracts = readFileSync(join(root, "docs/api-contracts.md"), "utf8");
    assert.doesNotMatch(apiContracts, /\(planned\)/);
    assert.match(apiContracts, /Track 30|Implemented/);

    const backendArch = readFileSync(join(root, "docs/backend-architecture.md"), "utf8");
    assert.doesNotMatch(backendArch, /^# Paytm Craft — Backend architecture \(planned\)/m);
    assert.match(backendArch, /Implemented/);

    const schema = readFileSync(join(root, "docs/database-schema.md"), "utf8");
    assert.doesNotMatch(schema, /\(planned\)/);
    assert.match(schema, /schema\.prisma/);

    const realtime = readFileSync(join(root, "docs/realtime-collaboration.md"), "utf8");
    assert.doesNotMatch(realtime, /\(planned\)/);
    assert.match(realtime, /craft-realtime/);
  });
});
