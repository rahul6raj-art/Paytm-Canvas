import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanProductName,
  extractProductNameFromPrompt,
  isActivityTrackingPrompt,
} from "@/lib/aiPromptExtract";
import { extractScreenTitle } from "@/lib/aiScreenIntent";
import { buildRichScreenForIntent } from "@/lib/aiRichMobileBuilder";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

describe("aiPromptExtract", () => {
  it("extracts Activity Tracking from create mobile app prompts", () => {
    const prompt = "Create the Activity Tracking mobile app. Do the deep research.";
    assert.equal(extractProductNameFromPrompt(prompt), "Activity Tracking");
    assert.equal(extractScreenTitle(prompt, "generic_mobile"), "Activity Tracking");
    assert.equal(isActivityTrackingPrompt(prompt), true);
  });

  it("does not dump the full prompt as product name", () => {
    const name = extractProductNameFromPrompt("Create the Activity Tracking mobile app. Do the deep research.");
    assert.ok(!name?.includes("deep research"));
  });

  it("cleans filler words from names", () => {
    assert.equal(cleanProductName("the Activity Tracking mobile"), "Activity Tracking");
  });
});

describe("activity tracking rich screen", () => {
  it("builds stats, chart, and recent activity rows", () => {
    const tokens = extractDesignTokens("", "Create the Activity Tracking mobile app", "fintech");
    const result = buildRichScreenForIntent("activity_tracking", {
      prompt: "Create the Activity Tracking mobile app. Do the deep research.",
      tokens,
      modelId: "openai:gpt-4o-mini",
    });
    assert.ok(result);
    const nodes = Object.values(result!.slice.nodes);
    assert.equal(
      nodes.some((n) => n.name === "Scroll content"),
      false,
    );
    assert.equal(
      nodes.some((n) => n.content?.includes("deep research")),
      false,
    );
    assert.equal(
      nodes.some((n) => n.content === "8,432" || n.content === "Steps"),
      true,
    );
    assert.equal(
      nodes.some((n) => n.content === "Morning Run"),
      true,
    );
    assert.ok(nodes.some((n) => n.name.endsWith(" icon")), "expected icon badges on screen");
    const frameId = result!.slice.childOrder[EDITOR_ROOT_KEY]?.[0];
    const frame = frameId ? result!.slice.nodes[frameId] : undefined;
    assert.ok(frame, "expected screen frame");
    assert.notEqual(frame!.height, 812, "frame should not use the fixed 812px device shell height");
    assert.equal(frame!.layoutSizingVertical, "hug", "frame height should hug content");
  });
});
