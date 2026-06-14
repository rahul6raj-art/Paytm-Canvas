import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  looksLikeManagedPostgresUrl,
  looksLikeR2Endpoint,
  looksLikeTlsRedisUrl,
  missingProductionEnvKeys,
  productionAuthProfileLooksHardened,
  productionWebClientLooksConfigured,
  PRODUCTION_BACKEND_SECRET_KEYS,
  PRODUCTION_SMTP_KEYS,
  PRODUCTION_WEB_PUBLIC_KEYS,
} from "@/lib/productionDeployChecks";

const root = process.cwd();

function read(rel: string): string {
  const path = join(root, rel);
  assert.ok(existsSync(path), `missing ${rel}`);
  return readFileSync(path, "utf8");
}

describe("productionDeployChecks", () => {
  const template = () => read("deploy/production/env.example.env");

  it("production env template documents required backend secrets", () => {
    const missing = missingProductionEnvKeys(template(), PRODUCTION_BACKEND_SECRET_KEYS);
    assert.deepEqual(missing, []);
  });

  it("production env template documents SMTP keys", () => {
    const missing = missingProductionEnvKeys(template(), PRODUCTION_SMTP_KEYS);
    assert.deepEqual(missing, []);
  });

  it("production env template documents web client env", () => {
    const missing = missingProductionEnvKeys(template(), PRODUCTION_WEB_PUBLIC_KEYS);
    assert.deepEqual(missing, []);
  });

  it("template uses hardened production auth profile", () => {
    assert.equal(productionAuthProfileLooksHardened(template()), true);
  });

  it("template configures remote web client with HTTPS + WSS", () => {
    assert.equal(productionWebClientLooksConfigured(template()), true);
  });

  it("recognizes managed service URL shapes", () => {
    assert.equal(
      looksLikeManagedPostgresUrl("postgresql://u:p@ep-abc.region.aws.neon.tech/craft?sslmode=require"),
      true,
    );
    assert.equal(looksLikeTlsRedisUrl("rediss://default:tok@host:6379"), true);
    assert.equal(
      looksLikeR2Endpoint("https://abc123.r2.cloudflarestorage.com"),
      true,
    );
  });
});

describe("productionDeployArtifacts", () => {
  it("includes production README and runbook", () => {
    const readme = read("deploy/production/README.md");
    assert.match(readme, /Neon/);
    assert.match(readme, /R2/);
    assert.match(readme, /Resend/);
    assert.match(readme, /Cutover checklist/);
  });

  it("links production deploy from deploy index", () => {
    const deployReadme = read("deploy/README.md");
    assert.match(deployReadme, /production/);
  });
});
