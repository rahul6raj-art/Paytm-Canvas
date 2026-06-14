import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

const TRACK_DOCS = [
  "docs/tracks.md",
  "docs/api-persistence-track.md",
  "docs/integration-track.md",
  "docs/backend-track.md",
  "docs/client-remote-track.md",
  "docs/auth-ui-track.md",
  "docs/release-track.md",
  "docs/rbac-track.md",
  "docs/team-dashboard-track.md",
  "docs/editor-team-track.md",
  "docs/email-invites-track.md",
  "docs/teams-track.md",
  "docs/dashboard-teams-track.md",
  "docs/production-track.md",
  "docs/smtp-invites-track.md",
  "docs/deploy-track.md",
  "docs/team-switcher-track.md",
  "docs/live-stack-track.md",
  "docs/api-tokens-track.md",
  "docs/api-token-ui-track.md",
  "docs/api-token-scopes-track.md",
  "docs/integration-release-track.md",
  "docs/api-token-resource-scopes-track.md",
  "docs/mock-api-tokens-track.md",
  "docs/production-deploy-track.md",
  "docs/canvas-chrome-track.md",
  "docs/legacy-renderer-cleanup-track.md",
  "docs/legacy-dead-code-track.md",
  "docs/ci-release-gate-track.md",
  "docs/api-contracts-track.md",
  "docs/tracks-manifest-track.md",
  "docs/editor-smoke-gate-track.md",
  "docs/live-stack-gate-track.md",
  "docs/migration-verify-gate-track.md",
  "docs/docker-stack-gate-track.md",
  "docs/release-stack-gate-track.md",
  "docs/native-renderer-migration.md",
  "docs/deployment.md",
];

const VERIFY_SCRIPTS = [
  "scripts/verify-stack.mjs",
  "scripts/verify-release.mjs",
  "scripts/verify-stack-live.ts",
  "scripts/verify-migration.mjs",
  "scripts/verify-deploy.mjs",
  "scripts/verify-production-deploy.mjs",
  "scripts/verify-canvas-chrome.mjs",
  "scripts/verify-legacy-cleanup.mjs",
  "scripts/verify-ci-gate.mjs",
  "scripts/verify-api-contracts.mjs",
  "scripts/verify-tracks-sync.mjs",
  "scripts/verify-editor-gate.mjs",
  "scripts/verify-stack-live-gate.mjs",
  "scripts/verify-migration-gate.mjs",
  "scripts/verify-docker-stack-gate.mjs",
  "scripts/verify-release-stack-gate.mjs",
];

describe("tracksIndex", () => {
  it("includes master tracks index", () => {
    const indexPath = join(root, "docs/tracks.md");
    assert.ok(existsSync(indexPath));
    const doc = readFileSync(indexPath, "utf8");
    assert.match(doc, /verify:release/);
    assert.match(doc, /\*\*22\*\*/);
    assert.match(doc, /\*\*23\*\*/);
    assert.match(doc, /\*\*24\*\*/);
    assert.match(doc, /\*\*25\*\*/);
    assert.match(doc, /\*\*26\*\*/);
    assert.match(doc, /\*\*27\*\*/);
    assert.match(doc, /\*\*28\*\*/);
    assert.match(doc, /\*\*29\*\*/);
    assert.match(doc, /\*\*30\*\*/);
    assert.match(doc, /\*\*31\*\*/);
    assert.match(doc, /\*\*32\*\*/);
    assert.match(doc, /\*\*33\*\*/);
    assert.match(doc, /\*\*34\*\*/);
    assert.match(doc, /\*\*35\*\*/);
    assert.match(doc, /\*\*36\*\*/);
    assert.match(doc, /live-stack-gate-track/);
    assert.match(doc, /verify:stack-live-gate/);
    assert.match(doc, /migration-verify-gate-track/);
    assert.match(doc, /verify:migration-gate/);
    assert.match(doc, /docker-stack-gate-track/);
    assert.match(doc, /verify:docker-stack-gate/);
    assert.match(doc, /release-stack-gate-track/);
    assert.match(doc, /verify:release-stack-gate/);
    assert.match(doc, /editor-smoke-gate-track/);
    assert.match(doc, /verify:editor-gate/);
    assert.match(doc, /tracks-manifest-track/);
    assert.match(doc, /verify:tracks-sync/);
    assert.match(doc, /api-contracts-track/);
    assert.match(doc, /verify:api-contracts/);
    assert.match(doc, /ci-release-gate-track/);
    assert.match(doc, /verify:ci-gate/);
    assert.match(doc, /canvas-chrome-track/);
    assert.match(doc, /legacy-renderer-cleanup-track/);
    assert.match(doc, /verify:canvas-chrome/);
    assert.match(doc, /verify:legacy-cleanup/);
  });

  it("lists all integration track docs", () => {
    for (const rel of TRACK_DOCS) {
      assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
    }
  });

  it("lists verify entry scripts", () => {
    for (const rel of VERIFY_SCRIPTS) {
      assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
    }
  });

  it("package.json exposes release verification", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    assert.ok(pkg.scripts?.["verify:release"]);
    assert.ok(pkg.scripts?.["verify:tracks"]);
    assert.ok(pkg.scripts?.["verify:stack"]);
    assert.ok(pkg.scripts?.["verify:production"]);
    assert.ok(pkg.scripts?.["verify:canvas-chrome"]);
    assert.ok(pkg.scripts?.["verify:legacy-cleanup"]);
    assert.ok(pkg.scripts?.["verify:ci-gate"]);
    assert.ok(pkg.scripts?.["verify:ci"]);
    assert.ok(pkg.scripts?.["verify:api-contracts"]);
    assert.ok(pkg.scripts?.["verify:tracks-sync"]);
    assert.ok(pkg.scripts?.["verify:editor-gate"]);
    assert.ok(pkg.scripts?.["verify:editor"]);
    assert.ok(pkg.scripts?.["verify:stack-live-gate"]);
    assert.ok(pkg.scripts?.["verify:migration-gate"]);
    assert.ok(pkg.scripts?.["verify:docker-stack-gate"]);
    assert.ok(pkg.scripts?.["verify:release-stack-gate"]);
    assert.ok(pkg.scripts?.["verify:stack:live"]);
  });
});
