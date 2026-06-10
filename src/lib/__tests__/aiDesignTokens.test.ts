import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CRAFT_INTER_FONT_STACK,
  extractDesignTokens,
  resolveDesignMdFontStack,
} from "@/lib/aiDesignTokens";
import { attachmentFromDesignMdText } from "@/lib/aiGenerateContext";
import { buildRichMobileHomeScreen } from "@/lib/aiRichMobileBuilder";

describe("aiDesignTokens", () => {
  it("maps inter-subset from design.md to Craft Inter stack", () => {
    assert.equal(resolveDesignMdFontStack("inter-subset, sans-serif"), CRAFT_INTER_FONT_STACK);
    assert.equal(
      resolveDesignMdFontStack(
        "inter-subset, -apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      ),
      CRAFT_INTER_FONT_STACK,
    );
  });

  it("extracts Inter stack from paytm design.md context", () => {
    const md = readFileSync("/Users/rahulraj/Downloads/paytm-design.md", "utf8");
    const att = attachmentFromDesignMdText("t", "paytm-design.md", md);
    const tokens = extractDesignTokens(att.summary, "Paytm home", "fintech");
    assert.equal(tokens.source, "design-md");
    assert.equal(tokens.fontFamily, CRAFT_INTER_FONT_STACK);
    assert.equal(tokens.shellWidth, 376);
  });

  it("applies design.md font to rich builder text nodes", () => {
    const md = readFileSync("/Users/rahulraj/Downloads/paytm-design.md", "utf8");
    const att = attachmentFromDesignMdText("t", "paytm-design.md", md);
    const tokens = extractDesignTokens(att.summary, "Paytm Good Morning Rahul", "fintech");
    const { slice } = buildRichMobileHomeScreen({
      prompt: "Paytm Good Morning Rahul",
      tokens,
      modelId: "test",
    });
    const textNodes = Object.values(slice.nodes).filter((n) => n.type === "text");
    assert.ok(textNodes.length > 10);
    for (const node of textNodes) {
      assert.equal(node.fontFamily, CRAFT_INTER_FONT_STACK, `wrong font on ${node.name}`);
    }
  });
});
