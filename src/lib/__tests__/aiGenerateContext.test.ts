import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterContextPromptForIntent, summarizeDesignMdTokensOnly } from "@/lib/aiGenerateContext";
import { detectScreenIntent } from "@/lib/aiScreenIntent";

const DESIGN_SNIPPET = `Design spec "Paytm":
colors:
  brand-primary: "#00b8f5"
typography:
  body-regular:
    fontSize: 14
    lineHeight: 20
    fontFamily: "inter-subset"
PODS super-app home with quick actions and bottom navigation for payments.`;

describe("aiGenerateContext intent filtering", () => {
  it("strips design.md home narrative for checkout intent", () => {
    const context = `[Design .md: paytm-design.md]\n${DESIGN_SNIPPET}`;
    const filtered = filterContextPromptForIntent(context, "checkout");
    assert.match(filtered, /colors:/);
    assert.doesNotMatch(filtered, /quick actions and bottom navigation/);
    assert.match(filtered, /do not infer screen type/i);
  });

  it("strips design.md narrative even for mobile home intent", () => {
    const context = `[Design .md: paytm-design.md]\n${DESIGN_SNIPPET}`;
    const filtered = filterContextPromptForIntent(context, "mobile_home");
    assert.doesNotMatch(filtered, /quick actions and bottom navigation/);
    assert.match(filtered, /colors:/);
  });

  it("adds 1:1 replication hint for reference images", () => {
    const context = `[Image: checkout-reference.png]\nImage "checkout-reference.png" (image/png, 120KB).`;
    const filtered = filterContextPromptForIntent(context, "checkout");
    assert.match(filtered, /Replicate this screen layout/i);
  });

  it("detects checkout from image filename in context", () => {
    const context = `[Image: paytm-checkout.png]\nImage metadata.`;
    assert.equal(
      detectScreenIntent("Build this screen with Paytm tokens", "Mobile app", context),
      "checkout",
    );
  });

  it("summarizeDesignMdTokensOnly omits narrative body", () => {
    const tokens = summarizeDesignMdTokensOnly(DESIGN_SNIPPET, "paytm-design.md");
    assert.match(tokens, /brand-primary/);
    assert.doesNotMatch(tokens, /bottom navigation/);
  });
});
