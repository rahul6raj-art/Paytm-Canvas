import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { patchLinkedReactSourceFromCanvas } from "../patchLinkedReactSource";

const SOURCE = `
export const PMLMorePage = () => (
  <div className="pml-more">
    <Header title="More" />
    <SectionHeader title="Appearance" trailing="none" />
    <Card className="pml-more-theme-card">
      <span className="pml-more-theme-card__label body-medium">Dark theme</span>
    </Card>
    <SectionHeader title="Account" trailing="none" />
    <ListItem primaryText="Create account" secondaryText="Sign up with mobile OTP" />
    <ListItem primaryText="Start onboarding" secondaryText="Full KYC flow from welcome to activation" />
  </div>
);
`;

function text(
  id: string,
  content: string,
  className: string,
  y: number,
): EditorNode {
  return {
    id,
    parentId: "root",
    type: "text",
    name: content,
    x: 0,
    y,
    width: 100,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    codeClassName: className,
    fontSize: 14,
    fill: "#111",
    textColor: "#111",
  };
}

describe("patchLinkedReactSourceFromCanvas", () => {
  it("updates text props and labels without replacing the whole file", () => {
    const nodes: Record<string, EditorNode> = {
      header: text("header", "Settings", "header__bar-title", 10),
      appearance: text("appearance", "Look & feel", "sh__title", 80),
      account: text("account", "Profile", "sh__title", 200),
      theme: text("theme", "Night mode", "pml-more-theme-card__label", 120),
      primaryA: text("primaryA", "Join now", "li-item__primary", 240),
      secondaryA: text("secondaryA", "Use OTP", "li-item__secondary", 260),
      primaryB: text("primaryB", "Begin setup", "li-item__primary", 320),
      secondaryB: text("secondaryB", "Complete KYC", "li-item__secondary", 340),
    };

    const out = patchLinkedReactSourceFromCanvas(SOURCE, nodes, { additionsOnly: false });
    assert.match(out, /title="Settings"/);
    assert.match(out, /title="Look & feel"/);
    assert.match(out, /title="Profile"/);
    assert.match(out, />Night mode</);
    assert.match(out, /primaryText="Join now"/);
    assert.match(out, /secondaryText="Use OTP"/);
    assert.match(out, /primaryText="Begin setup"/);
    assert.match(out, /secondaryText="Complete KYC"/);
    assert.doesNotMatch(out, /@paytm-craft-payload-start/);
  });

  it("patches generic class-based text nodes such as bottom nav labels", () => {
    const source = `
export const PMLMorePage = () => (
  <nav className="bn">
    <span className="bn__label">Home</span>
    <span className="bn__label">More</span>
  </nav>
);
`;
    const nodes: Record<string, EditorNode> = {
      home: text("home", "Dashboard", "bn__label body-medium", 900),
      more: text("more", "Settings", "bn__label body-medium", 920),
    };
    const out = patchLinkedReactSourceFromCanvas(source, nodes, {
      additionsOnly: false,
      skipGenericTextPatches: false,
    });
    assert.match(out, />Dashboard</);
    assert.match(out, />Settings</);
  });
});
