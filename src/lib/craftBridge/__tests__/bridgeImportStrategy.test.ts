import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  removeRootSubtree,
  resolveBridgeCanvasIdentity,
  resolveBridgeImportStrategy,
  screenLabelFromSourcePath,
} from "../bridgeImportStrategy";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

function frame(id: string, opts?: Partial<EditorNode>): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name: id,
    x: 80,
    y: 80,
    width: 376,
    height: 844,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...opts,
  };
}

describe("resolveBridgeImportStrategy", () => {
  it("replaces when the canvas has no root frames", () => {
    assert.deepEqual(
      resolveBridgeImportStrategy(
        { childOrder: { [EDITOR_ROOT_KEY]: [] }, nodes: {} },
        "src/screens/PMLMorePage/PMLMorePage.tsx",
      ),
      { mode: "replace" },
    );
  });

  it("appends when importing a different screen", () => {
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["more"] },
          nodes: {
            more: frame("more", {
              name: "PML- More",
              bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
            }),
          },
        },
        "src/screens/PMLSignupPage/PMLSignupPage.tsx",
      ),
      { mode: "append" },
    );
  });

  it("replaces an existing artboard when the same source is pushed again", () => {
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["more"] },
          nodes: {
            more: frame("more", {
              name: "PML- More",
              bridgeSourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
              x: 120,
              y: 64,
            }),
          },
        },
        "src/screens/PMLMorePage/PMLMorePage.tsx",
      ),
      { mode: "replace-root", rootId: "more", x: 120, y: 64 },
    );
  });

  it("matches by screen label when bridgeSourcePath is missing", () => {
    assert.equal(
      screenLabelFromSourcePath("src/screens/PMLMorePage/PMLMorePage.tsx"),
      "PML- More",
    );
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["more"] },
          nodes: { more: frame("more", { name: "PML- More", x: 80, y: 80 }) },
        },
        "src/screens/PMLMorePage/PMLMorePage.tsx",
      ),
      { mode: "replace-root", rootId: "more", x: 80, y: 80 },
    );
  });

  it("appends onboarding steps that share one source file but differ by preview route", () => {
    const sharedFile = "src/features/onboarding-flow/OnboardingFlow.tsx";
    const mobilePreview = "preview://?screen=onboarding&step=mobile";
    const otpPreview = "preview://?screen=onboarding&step=otp";
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["mobile"] },
          nodes: {
            mobile: frame("mobile", {
              name: "Onboarding — Mobile",
              bridgeSourcePath: mobilePreview,
              x: 80,
              y: 80,
            }),
          },
        },
        otpPreview,
      ),
      { mode: "append" },
    );
    assert.deepEqual(
      resolveBridgeImportStrategy(
        {
          childOrder: { [EDITOR_ROOT_KEY]: ["mobile"] },
          nodes: {
            mobile: frame("mobile", {
              name: "Onboarding — Mobile",
              bridgeSourcePath: mobilePreview,
              x: 80,
              y: 80,
            }),
          },
        },
        mobilePreview,
      ),
      { mode: "replace-root", rootId: "mobile", x: 80, y: 80 },
    );
    assert.notEqual(mobilePreview, sharedFile);
  });
});

describe("resolveBridgeCanvasIdentity", () => {
  it("prefers preview route over linked file path", () => {
    assert.equal(
      resolveBridgeCanvasIdentity({
        sourcePath: "src/features/onboarding-flow/OnboardingFlow.tsx",
        previewUrl: "http://localhost:5173/?screen=onboarding&step=mobile&theme=light",
        repoRoot: "/repo",
      }),
      "preview://?screen=onboarding&step=mobile",
    );
  });

  it("falls back to file path when previewUrl is missing", () => {
    assert.equal(
      resolveBridgeCanvasIdentity({
        sourcePath: "src/screens/PMLMorePage/PMLMorePage.tsx",
        repoRoot: "/repo",
      }),
      "src/screens/PMLMorePage/PMLMorePage.tsx",
    );
  });
});

describe("removeRootSubtree", () => {
  it("removes a root frame and its descendants", () => {
    const nodes = {
      root: frame("root"),
      child: { ...frame("child"), parentId: "root" },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["child"],
    };
    const cleaned = removeRootSubtree(nodes, childOrder, "root");
    assert.deepEqual(cleaned.childOrder[EDITOR_ROOT_KEY], []);
    assert.equal(cleaned.nodes.root, undefined);
    assert.equal(cleaned.nodes.child, undefined);
  });
});
