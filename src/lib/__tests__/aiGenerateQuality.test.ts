import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUseRichFastPath, tryRichGenerate } from "@/lib/aiGenerateFastPath";
import { isSparseLLMLayout, shouldPreferRichBuilder } from "@/lib/aiGenerateQuality";
import { buildDesignFromLLMSpec } from "@/lib/aiDesignSpec";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import {
  buildRichAuthScreen,
  buildRichScreenForIntent,
  supportsRichScreen,
} from "@/lib/aiRichMobileBuilder";

describe("aiGenerateFastPath", () => {
  it("builds auth screens locally without API", () => {
    assert.equal(
      canUseRichFastPath({ prompt: "Login with phone and OTP", style: "fintech" }),
      true,
    );
    const out = tryRichGenerate({
      prompt: "Login with phone and OTP",
      style: "fintech",
      model: "cursor:claude-opus-4-8",
    });
    assert.ok(out?.ok);
    assert.equal(out?.source, "rich");
    assert.ok(Object.keys(out!.result!.slice.nodes).length >= 13);
  });

  it("skips fast path for dashboard prompts", () => {
    assert.equal(
      canUseRichFastPath({ prompt: "Analytics dashboard with KPI cards", style: "fintech" }),
      false,
    );
  });
});

describe("aiGenerateQuality", () => {
  it("prefers rich builder for auth without reference images", () => {
    assert.equal(shouldPreferRichBuilder("auth", false), true);
    assert.equal(shouldPreferRichBuilder("auth", true), false);
    assert.equal(shouldPreferRichBuilder("dashboard", false), false);
  });

  it("detects sparse LLM auth layouts", () => {
    const sparse = buildDesignFromLLMSpec(
      {
        title: "Login",
        elements: [
          { type: "text", content: "Hi", x: 10, y: 10, width: 100, height: 20 },
          { type: "rectangle", x: 10, y: 40, width: 200, height: 40 },
        ],
      },
      {
        prompt: "login",
        style: "fintech",
        modelId: "openai:gpt-4o-mini",
        intent: "auth",
      },
    );
    assert.equal(isSparseLLMLayout(sparse, "auth"), true);
  });
});

describe("aiRichMobileBuilder auth", () => {
  it("builds a multi-layer login screen from design tokens", () => {
    const tokens = extractDesignTokens("", "Design a login page with mobile number and OTP", "fintech");
    const result = buildRichAuthScreen({
      prompt: "Login page — welcome headline, mobile number, OTP, Continue button",
      tokens,
      modelId: "cursor:claude-opus-4-8",
    });
    const nodeCount = Object.keys(result.slice.nodes).length;
    assert.ok(nodeCount >= 13, `expected rich auth, got ${nodeCount} nodes`);
    assert.equal(result.preview.generationSource, "rich");
    assert.equal(
      Object.values(result.slice.nodes).some((n) => n.name === "Scroll content"),
      false,
    );
  });

  it("supports generic mobile intent", () => {
    assert.equal(supportsRichScreen("generic_mobile"), true);
    const tokens = extractDesignTokens("", "Settings screen with notifications list", "fintech");
    const result = buildRichScreenForIntent("generic_mobile", {
      prompt: "Settings screen\n- Notifications\n- Security\n- Payment methods",
      tokens,
      modelId: "openai:gpt-4o-mini",
    });
    assert.ok(result);
    assert.ok(Object.keys(result.slice.nodes).length >= 18);
  });
});
