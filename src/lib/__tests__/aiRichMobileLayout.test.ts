import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import { buildRichMobileHomeScreen } from "@/lib/aiRichMobileBuilder";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

function localRight(
  id: string,
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  rootId: string,
): number {
  let x = nodes[id]!.x;
  let p = nodes[id]!.parentId;
  while (p && p !== rootId) {
    x += nodes[p]!.x;
    p = nodes[p]!.parentId;
  }
  return x + nodes[id]!.width;
}

describe("aiRichMobileLayout", () => {
  it("keeps mobile home layers inside the 376px shell", () => {
    const tokens = extractDesignTokens("", "Paytm home screen", "fintech");
    const result = buildRichMobileHomeScreen({
      prompt: "Paytm home with quick actions and transactions",
      tokens,
      modelId: "openai:gpt-4o-mini",
    });
    const frameId = result.slice.childOrder[EDITOR_ROOT_KEY]?.[0];
    assert.ok(frameId);
    const frame = result.slice.nodes[frameId!]!;
    assert.equal(frame.width, 376);
    assert.equal(frame.clipChildren, true);

    const overflow = Object.keys(result.slice.nodes).filter((id) => {
      if (id === frameId) return false;
      return localRight(id, result.slice.nodes, frameId!) > frame.width + 0.5;
    });
    assert.equal(overflow.length, 0, `nodes outside shell: ${overflow.join(", ")}`);
  });

  it("uses fixed text boxes for centered grid labels and CTAs", () => {
    const tokens = extractDesignTokens("", "Paytm home screen", "fintech");
    const result = buildRichMobileHomeScreen({
      prompt: "Paytm home with quick actions and transactions",
      tokens,
      modelId: "openai:gpt-4o-mini",
    });
    const nodes = result.slice.nodes;

    const scanPay = Object.values(nodes).find((n) => n.type === "text" && n.content === "Scan & Pay");
    assert.ok(scanPay);
    assert.equal(scanPay!.textResizeMode, "fixed");
    assert.equal(scanPay!.textAlign, "center");
    assert.equal(scanPay!.verticalAlign, "middle");

    const addMoney = Object.values(nodes).find((n) => n.type === "text" && n.content === "Add Money");
    assert.ok(addMoney);
    assert.equal(addMoney!.textResizeMode, "fixed");
    assert.equal(addMoney!.verticalAlign, "middle");

    const homeTab = Object.values(nodes).find((n) => n.type === "text" && n.content === "Home");
    assert.ok(homeTab);
    assert.equal(homeTab!.textResizeMode, "fixed");
    assert.equal(homeTab!.textAlign, "center");

    const glyph = Object.values(nodes).find((n) => n.type === "text" && n.name?.endsWith(" glyph"));
    assert.ok(glyph);
    assert.equal(glyph!.textResizeMode, "fixed");
    assert.equal(glyph!.verticalAlign, "middle");
  });
});
