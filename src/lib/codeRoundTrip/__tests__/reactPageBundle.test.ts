import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nodeMatchesCssRule, parsePageCssRules } from "../parsePageCss";
import { applyPageCssToSlice } from "../applyPageCssToSlice";
import { importReactPageBundle } from "../importReactPageBundle";
import { EDITOR_ROOT_KEY } from "../../editorConstants";
import {
  PML_PHONE_COLUMN_WIDTH,
  PML_PHONE_VIEWPORT_HEIGHT,
} from "@/lib/craftBridge/pmlScreenMetrics";

describe("parsePageCssRules", () => {
  it("parses compound class selectors", () => {
    const rules = parsePageCssRules(`
      .badge--primary.badge--muted {
        background-color: #0f303d;
        color: #2cb1fe;
      }
    `);
    assert.equal(rules.length, 1);
    assert.deepEqual(rules[0]?.classes, ["badge--primary", "badge--muted"]);
    assert.equal(rules[0]?.declarations["background-color"], "#0f303d");
  });

  it("matches nodes by full class token set", () => {
    const rule = parsePageCssRules(".badge--primary.badge--muted { color: red; }")[0]!;
    assert.equal(nodeMatchesCssRule("badge badge--text badge--primary badge--muted", rule), true);
    assert.equal(nodeMatchesCssRule("badge badge--primary", rule), false);
  });
});

describe("importReactPageBundle", () => {
  const signupCss = `
    .pml-signup {
      background-color: #101010;
      width: 390px;
      height: 844px;
    }
    .pml-signup__hero-title {
      color: #ffffff;
      font-size: 36px;
    }
  `;

  const signupTsx = `
import './PMLSignupPage.css';
export default function PMLSignupPage() {
  return (
    <div className="pml-signup">
      <h1 className="pml-signup__hero-title">Create your account</h1>
    </div>
  );
}
`;

  it("applies page CSS classes onto parsed structure", () => {
    const result = importReactPageBundle({
      tsxSource: signupTsx,
      cssSources: [signupCss],
      fileName: "PMLSignupPage.tsx",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const nodes = Object.values(result.slice.nodes);
    const root = nodes.find((n) => n.codeClassName === "pml-signup");
    assert.equal(root?.name, "PML- Signup");
    const title = nodes.find((n) => n.codeClassName === "pml-signup__hero-title");
    assert.equal(root?.fill, "#101010");
    assert.equal(root?.fillEnabled, true);
    assert.equal(title?.fill ?? title?.textColor, "#ffffff");
    assert.equal(title?.fontSize, 36);
  });

  it("applyPageCssToSlice leaves graph structure intact", () => {
    const parsed = importReactPageBundle({ tsxSource: signupTsx, cssSources: [] });
    if (!parsed.ok) throw new Error("parse failed");
    const withCss = applyPageCssToSlice(parsed.slice, [signupCss]);
    assert.deepEqual(withCss.childOrder[EDITOR_ROOT_KEY], parsed.slice.childOrder[EDITOR_ROOT_KEY]);
    assert.equal(Object.keys(withCss.nodes).length, Object.keys(parsed.slice.nodes).length);
  });

  it("preserves vertical spacing below theme card from page CSS margin", () => {
    const css = `
      .pml-more { display: flex; flex-direction: column; }
      .pml-more-theme-card { margin-bottom: 24px; }
    `;
    const tsx = `
      export const PMLMorePage = () => (
        <div className="pml-more">
          <SectionHeader title="Appearance" trailing="none" />
          <Card className="pml-more-theme-card">
            <span className="pml-more-theme-card__label">Dark theme</span>
          </Card>
          <SectionHeader title="Account" trailing="none" />
          <ListItem primaryText="Start onboarding" secondaryText="Full KYC flow from welcome to activation" />
        </div>
      );
    `;
    const result = importReactPageBundle({ tsxSource: tsx, cssSources: [css], fileName: "PMLMorePage.tsx" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.slice.fileName, "PML- More");

    const nodes = Object.values(result.slice.nodes);
    const root = nodes.find((n) => n.codeClassName === "pml-more");
    assert.equal(root?.name, "PML- More");
    const card = nodes.find((n) => n.codeClassName?.includes("pml-more-theme-card"));
    const accountHeader = nodes.find((n) => n.codeJsxTag === "SectionHeader" && n.y > (card?.y ?? 0));
    assert.ok(card, "theme card should exist");
    assert.ok(accountHeader, "account section header should exist");
    const gap = accountHeader!.y - (card!.y + card!.height);
    assert.ok(gap >= 24, `expected >=24px gap below theme card, got ${gap}`);
  });

  it("does not collapse flex containers when CSS uses min-height: 0", () => {
    const css = `
      .screen { display: flex; flex-direction: column; height: 100dvh; }
      .screen__main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .screen__scroll { min-height: 0; display: flex; flex-direction: column; }
      .screen__hero-title { color: #fff; font-size: 36px; }
    `;
    const tsx = `
      export default function Screen() {
        return (
          <div className="screen">
            <header style={{ height: 56 }}>Top</header>
            <div className="screen__main">
              <div className="screen__scroll">
                <h1 className="screen__hero-title">Create your account</h1>
              </div>
            </div>
          </div>
        );
      }
    `;
    const result = importReactPageBundle({ tsxSource: tsx, cssSources: [css], fileName: "Screen.tsx" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const main = Object.values(result.slice.nodes).find((n) => n.codeClassName === "screen__main");
    const scroll = Object.values(result.slice.nodes).find((n) => n.codeClassName === "screen__scroll");
    assert.ok((main?.height ?? 0) > 40, `main height ${main?.height}`);
    assert.ok((scroll?.height ?? 0) > 40, `scroll height ${scroll?.height}`);
    assert.equal(main?.clipChildren, false);
  });

  it("locks PML screen artboard to phone viewport with clipped bounds", () => {
    const css = `
      .pml-signup { display: flex; flex-direction: column; width: 390px; height: 844px; }
      .pml-signup__main { display: flex; flex-direction: column; flex: 1; width: 390px; }
    `;
    const tsx = `
      export default function PMLSignupPage() {
        return (
          <div className="pml-signup">
            <div className="pml-signup__main">
              <h1 className="pml-signup__hero-title">Hello</h1>
            </div>
          </div>
        );
      }
    `;
    const result = importReactPageBundle({ tsxSource: tsx, cssSources: [css], fileName: "PMLSignupPage.tsx" });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const root = Object.values(result.slice.nodes).find((n) => n.codeClassName === "pml-signup");
    assert.ok(root);
    assert.equal(root!.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(root!.height, PML_PHONE_VIEWPORT_HEIGHT);
    assert.equal(root!.clipChildren, true);

    const main = Object.values(result.slice.nodes).find((n) => n.codeClassName === "pml-signup__main");
    assert.ok(main);
    assert.ok(main!.width <= PML_PHONE_COLUMN_WIDTH, `main width ${main!.width} exceeds column`);
    assert.ok(main!.x + main!.width <= PML_PHONE_COLUMN_WIDTH, "main spills past screen width");
  });

  it("preserves flex metadata while pinning children absolute for 1:1 geometry", () => {
    const css = `
      .pml-signup { display: flex; flex-direction: column; width: 390px; height: 844px; }
      .pml-signup__main { display: flex; flex-direction: column; flex: 1; }
    `;
    const tsx = `
      export default function PMLSignupPage() {
        return (
          <div className="pml-signup">
            <div className="pml-signup__main">
              <h1 className="pml-signup__hero-title">Hello</h1>
            </div>
          </div>
        );
      }
    `;
    const result = importReactPageBundle({ tsxSource: tsx, cssSources: [css], fileName: "PMLSignupPage.tsx" });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const main = Object.values(result.slice.nodes).find((n) => n.codeClassName === "pml-signup__main");
    assert.ok(main, "main stack should exist");
    assert.equal(main!.layoutMode, "vertical");
    const title = Object.values(result.slice.nodes).find((n) => n.codeClassName === "pml-signup__hero-title");
    assert.ok(title);
    assert.equal(title!.layoutPositioning, "absolute");
  });
});
