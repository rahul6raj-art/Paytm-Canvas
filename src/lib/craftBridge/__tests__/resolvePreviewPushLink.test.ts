import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { previewScreenId } from "../resolvePreviewPushLink";

describe("resolvePreviewPushLink", () => {
  it("reads screen id from preview URL", () => {
    assert.equal(previewScreenId("http://localhost:5173/?screen=home"), "home");
    assert.equal(previewScreenId("http://localhost:5173/?screen=more&theme=dark"), "more");
    assert.equal(previewScreenId("http://localhost:5173/"), "home");
    assert.equal(previewScreenId("http://localhost:5173/settings/profile"), "settings-profile");
  });

  it("resolves PML home link from manifest when repo is present", async () => {
    const { resolvePreviewPushLink } = await import("../resolvePreviewPushLink");
    const candidates = [
      path.resolve(process.cwd(), "../../Neon /PML-Neon-Flux-V1"),
      "/Users/rahulraj/Neon /PML-Neon-Flux-V1",
    ];
    const repoRoot = candidates.find((p) => fs.existsSync(path.join(p, "craft.link.json")));
    if (!repoRoot) return;

    const result = resolvePreviewPushLink(
      repoRoot,
      "http://localhost:5173/?screen=home&theme=dark",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "linked");
      assert.match(result.pagePath, /PMLHomePage/i);
    }
  });

  it("ignores stale craft.link entries and infers screen folder from ?screen=", async () => {
    const { resolvePreviewPushLink } = await import("../resolvePreviewPushLink");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-link-test-"));
    const repoRoot = path.join(tmp, "repo");
    fs.mkdirSync(path.join(repoRoot, "src/screens/PMLHomePage"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "src/screens/PMLHomePage/PMLHomePage.tsx"),
      "export default function PMLHomePage() { return null; }\n",
    );
    fs.writeFileSync(
      path.join(repoRoot, "craft.link.json"),
      JSON.stringify({
        repoRoot,
        links: [
          {
            sourcePath: "src/screens/ExampleScreen/ExampleScreen.tsx",
            previewUrl: "http://localhost:5173",
          },
        ],
      }),
    );

    const result = resolvePreviewPushLink(
      repoRoot,
      "http://localhost:5173/?screen=home",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "linked");
      assert.match(result.pagePath, /PMLHomePage/);
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("resolves onboarding from disk without a valid manifest link", async () => {
    const { resolvePreviewPushLink } = await import("../resolvePreviewPushLink");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-onboarding-link-"));
    const repoRoot = path.join(tmp, "repo");
    fs.mkdirSync(path.join(repoRoot, "src/features/onboarding-flow"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "src/features/onboarding-flow/OnboardingFlow.tsx"),
      "export default function OnboardingFlow() { return null; }\n",
    );

    const result = resolvePreviewPushLink(
      repoRoot,
      "http://localhost:5173/?screen=onboarding&theme=light",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "linked");
      assert.match(result.pagePath, /onboarding-flow/);
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("uses capture-only when live URL is more specific than craft.link previewUrl", async () => {
    const { resolvePreviewPushLink } = await import("../resolvePreviewPushLink");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-specific-route-"));
    const repoRoot = path.join(tmp, "repo");
    fs.mkdirSync(path.join(repoRoot, "src/screens/PMLHomePage"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "src/screens/PMLHomePage/PMLHomePage.tsx"),
      "export default function PMLHomePage() { return null; }\n",
    );
    fs.writeFileSync(
      path.join(repoRoot, "craft.link.json"),
      JSON.stringify({
        repoRoot,
        links: [
          {
            sourcePath: "src/screens/PMLHomePage",
            previewUrl: "http://localhost:5173/?screen=home",
          },
        ],
      }),
    );

    const homeTab = resolvePreviewPushLink(
      repoRoot,
      "http://localhost:5173/?screen=home&homeTab=ipos",
    );
    assert.equal(homeTab.ok, true);
    if (homeTab.ok) {
      assert.equal(homeTab.mode, "capture-only");
      assert.equal(homeTab.routeKey, "/?screen=home&homeTab=ipos");
    }

    const onboardingStep = resolvePreviewPushLink(
      repoRoot,
      "http://localhost:5173/?screen=onboarding&step=mobile",
    );
    assert.equal(onboardingStep.ok, true);
    if (onboardingStep.ok) {
      assert.equal(onboardingStep.mode, "capture-only");
      assert.match(onboardingStep.routeKey, /step=mobile/);
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
