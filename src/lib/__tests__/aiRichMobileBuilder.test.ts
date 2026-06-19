import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRichCheckoutScreen,
  buildRichScreenForIntent,
  supportsRichScreen,
} from "@/lib/aiRichMobileBuilder";
import { extractDesignTokens } from "@/lib/aiDesignTokens";

describe("aiRichMobileBuilder", () => {
  it("supports rich fallback for checkout and related intents", () => {
    assert.equal(supportsRichScreen("checkout"), true);
    assert.equal(supportsRichScreen("send_money"), true);
    assert.equal(supportsRichScreen("auth"), true);
    assert.equal(supportsRichScreen("generic_mobile"), true);
    assert.equal(supportsRichScreen("dashboard"), false);
  });

  it("builds a multi-layer checkout screen from design tokens", () => {
    const tokens = extractDesignTokens("", "Pay ₹1,249 to Swiggy", "template");
    const result = buildRichCheckoutScreen({
      prompt: "Checkout / payment for Swiggy order ₹1,249",
      tokens,
      modelId: "ollama:llama3.2",
      contextAttachmentCount: 1,
    });

    const nodeCount = Object.keys(result.slice.nodes).length;
    assert.ok(nodeCount >= 30, `expected rich checkout, got ${nodeCount} nodes`);
    assert.equal(result.preview.generationSource, "rich");
    assert.match(result.preview.flowLabel, /Rich checkout/);
  });

  it("routes checkout intent through buildRichScreenForIntent", () => {
    const tokens = extractDesignTokens("", "", "template");
    const result = buildRichScreenForIntent("checkout", {
      prompt: "checkout screen",
      tokens,
      modelId: "ollama:llama3.2",
    });
    assert.ok(result);
    assert.ok(Object.keys(result.slice.nodes).length >= 30);
  });
});
