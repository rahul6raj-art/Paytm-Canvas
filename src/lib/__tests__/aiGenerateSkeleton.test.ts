import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAIGenerateSkeletonSlice,
  resolveAIGenerateSkeletonFrame,
} from "@/lib/aiGenerateSkeleton";
import { AI_GENERATE_SKELETON_FRAME_ID } from "@/lib/aiGenerateJob";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

describe("aiGenerateSkeleton", () => {
  it("uses rich-builder dimensions for activity tracking prompts", () => {
    const bounds = resolveAIGenerateSkeletonFrame({
      prompt: "Create the Activity Tracking mobile app",
      style: "fintech",
      model: "ollama:llama3.2",
    });
    assert.equal(bounds.width, 376);
    assert.notEqual(bounds.height, 812);
    assert.ok(bounds.height >= 280);
  });

  it("uses desktop dimensions for dashboard prompts", () => {
    const bounds = resolveAIGenerateSkeletonFrame({
      prompt: "Analytics dashboard with KPI cards and charts",
      style: "minimal",
      model: "ollama:llama3.2",
    });
    assert.equal(bounds.width, 1200);
    assert.equal(bounds.height, 800);
  });

  it("builds a transparent outline frame at resolved bounds", () => {
    const result = buildAIGenerateSkeletonSlice({
      prompt: "Create the Activity Tracking mobile app",
      style: "fintech",
      model: "ollama:llama3.2",
    });
    const frame = result.slice.nodes[AI_GENERATE_SKELETON_FRAME_ID];
    assert.ok(frame);
    assert.equal(frame.fillEnabled, false);
    assert.equal((result.slice.childOrder[EDITOR_ROOT_KEY] ?? []).length, 1);
  });
});
