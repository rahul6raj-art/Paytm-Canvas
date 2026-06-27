import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  canvasScreenLabelFromPreviewUrl,
  linkPreviewUrlMatchesRoute,
  previewCaptureSourcePath,
  previewRouteKey,
} from "@/lib/craftBridge/previewRouteKey";

describe("previewRouteKey", () => {
  it("normalizes pathname and strips theme param", () => {
    assert.equal(
      previewRouteKey("http://localhost:5173/settings/profile?theme=dark"),
      "/settings/profile",
    );
    assert.equal(
      previewRouteKey("http://localhost:5173/?screen=signup&theme=light"),
      "/?screen=signup",
    );
  });

  it("builds virtual source paths for preview captures", () => {
    assert.equal(
      previewCaptureSourcePath("http://localhost:5173/settings/profile"),
      "preview://settings/profile",
    );
  });

  it("labels internal routes from pathname", () => {
    assert.equal(
      canvasScreenLabelFromPreviewUrl("http://localhost:5173/settings/profile"),
      "Profile",
    );
  });

  it("matches linked preview URLs by route", () => {
    assert.equal(
      linkPreviewUrlMatchesRoute(
        "http://localhost:5173/settings/profile",
        "http://localhost:5173/settings/profile?theme=dark",
      ),
      true,
    );
    assert.equal(
      linkPreviewUrlMatchesRoute(
        "http://localhost:5173/?screen=more",
        "http://localhost:5173/?screen=home",
      ),
      false,
    );
  });
});

describe("resolvePreviewPushLink capture-only", () => {
  it("captures internal routes without a linked page folder", async () => {
    const { resolvePreviewPushLink } = await import("../resolvePreviewPushLink");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "craft-preview-route-"));
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

    const result = resolvePreviewPushLink(
      repoRoot,
      "http://localhost:5173/settings/profile?theme=light",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mode, "capture-only");
      assert.equal(result.routeKey, "/settings/profile");
      assert.equal(result.virtualSourcePath, "preview://settings/profile");
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
