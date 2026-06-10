import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectScreenIntent } from "@/lib/aiScreenIntent";
import { parseHomeSections } from "@/lib/aiRichMobileBuilder";
import { isRichMobileHomeIntent } from "@/lib/aiDesignTokens";

describe("aiScreenIntent", () => {
  it("honours explicit screen type in prompt over Screen preset", () => {
    assert.equal(detectScreenIntent("Paytm home screen with quick actions and UPI", "Checkout"), "mobile_home");
    assert.equal(detectScreenIntent("Create a checkout screen with cart summary", "Profile"), "checkout");
  });

  it("uses Screen preset when prompt has no explicit screen type", () => {
    assert.equal(detectScreenIntent("Paytm with quick actions and UPI", "Checkout"), "checkout");
    assert.equal(detectScreenIntent("anything", "Profile"), "profile");
    assert.equal(detectScreenIntent("anything", "Dashboard"), "dashboard");
  });

  it("does not treat Paytm feature lists as home without the word home", () => {
    const spec =
      "Paytm app with scan and pay, quick actions, UPI balance, bottom navigation, recharge, financial services";
    assert.equal(isRichMobileHomeIntent(spec), false);
    assert.equal(detectScreenIntent(spec, "Mobile app"), "generic_mobile");
  });

  it("only uses rich home when home is explicit", () => {
    assert.equal(
      detectScreenIntent(
        "Design Paytm home screen with quick actions, UPI balance, bottom nav",
        "Mobile app",
      ),
      "mobile_home",
    );
    assert.equal(detectScreenIntent("Create a checkout screen with cart summary", "Mobile app"), "checkout");
    assert.equal(detectScreenIntent("Build a user profile and settings page", "Mobile app"), "profile");
  });

  it("does not treat negated home phrasing as mobile home", () => {
    assert.equal(
      detectScreenIntent("Build checkout screen — not a home screen with quick actions", "Mobile app"),
      "checkout",
    );
  });

  it("parses a subset of home sections from focused prompts", () => {
    const sections = parseHomeSections("Minimal home — only quick actions and UPI balance, skip offers");
    assert.deepEqual(sections, ["quick_actions", "balance"]);
  });
});
