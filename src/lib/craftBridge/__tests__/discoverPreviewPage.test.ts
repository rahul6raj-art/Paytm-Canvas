import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverPreviewPagePath } from "../discoverPreviewPage";

function writePage(repoRoot: string, relDir: string, component: string) {
  const dir = path.join(repoRoot, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${component}.tsx`),
    `export default function ${component}() { return null; }\n`,
  );
}

describe("discoverPreviewPagePath", () => {
  it("finds standard PML screen folders", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-discover-"));
    const repoRoot = path.join(tmp, "repo");
    writePage(repoRoot, "src/screens/PMLMorePage", "PMLMorePage");

    assert.equal(discoverPreviewPagePath(repoRoot, "more"), "src/screens/PMLMorePage");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("maps fno and mf tabs to the home page folder", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-discover-"));
    const repoRoot = path.join(tmp, "repo");
    writePage(repoRoot, "src/screens/PMLHomePage", "PMLHomePage");

    assert.equal(discoverPreviewPagePath(repoRoot, "fno"), "src/screens/PMLHomePage");
    assert.equal(discoverPreviewPagePath(repoRoot, "mf"), "src/screens/PMLHomePage");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("finds onboarding under features", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-discover-"));
    const repoRoot = path.join(tmp, "repo");
    writePage(repoRoot, "src/features/onboarding-flow", "OnboardingFlow");

    assert.equal(
      discoverPreviewPagePath(repoRoot, "onboarding"),
      "src/features/onboarding-flow",
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
