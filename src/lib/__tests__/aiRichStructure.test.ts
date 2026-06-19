import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import { buildRichScreenForIntent } from "@/lib/aiRichMobileBuilder";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

const ROOT = EDITOR_ROOT_KEY;

describe("aiRichStructure", () => {
  it("groups activity screen layers into section frames instead of a flat list", () => {
    const tokens = extractDesignTokens("", "Create the Activity Tracking mobile app", "fintech");
    const result = buildRichScreenForIntent("generic_mobile", {
      prompt: "Create the Activity Tracking mobile app",
      tokens,
      modelId: "openai:gpt-4o-mini",
    });
    assert.ok(result);

    const frameId = result!.slice.childOrder[ROOT]?.[0];
    assert.ok(frameId);
    const topChildren = result!.slice.childOrder[frameId] ?? [];
    assert.ok(topChildren.length <= 6, `expected grouped top-level children, got ${topChildren.length}`);

    const nodes = result!.slice.nodes;
    const sectionFrames = Object.values(nodes).filter(
      (n) =>
        (n.type === "frame" || n.type === "group") &&
        n.id !== frameId &&
        n.name !== "Content" &&
        n.name !== "Status bar" &&
        n.name !== "Navigation" &&
        n.name !== "Footer",
    );
    assert.ok(sectionFrames.length >= 3, "expected grouped section frames");

    const content = topChildren
      .map((id) => nodes[id])
      .find((n) => n?.name === "Content");
    assert.ok(content, "expected Content stack frame");
    assert.equal(content?.layoutMode, "vertical");

    const statsSection = Object.values(nodes).find((n) => n.name === "Stats");
    assert.ok(statsSection, "expected Stats section frame");
    assert.equal(statsSection?.layoutMode, "horizontal");

    const frame = frameId ? nodes[frameId] : undefined;
    assert.ok(frame, "expected screen frame");
    assert.notEqual(frame!.height, 812, "screen frame should not use fixed device shell height");
    assert.equal(frame!.layoutSizingVertical, "hug");
    assert.ok(Object.values(nodes).some((n) => n.name.endsWith(" icon")), "expected decorative icons");
  });
});
