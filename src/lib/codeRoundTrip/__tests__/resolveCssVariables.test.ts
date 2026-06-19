import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCssCustomProperties } from "../parseCssCustomProperties";
import { resolveCssDeclarations } from "../resolveCssVariables";
import { parsePageCssRules } from "../parsePageCss";

describe("resolveCssVariables", () => {
  const tokenCss = `
:root { --surface-level-4: #F5F5F5; }
[data-theme='dark'] { --surface-level-4: #101010; }
`;

  const pageCss = `
.pml-signup { background: var(--surface-level-4); }
`;

  it("resolves dark theme token values onto page rules", () => {
    const rules = parsePageCssRules(pageCss);
    const resolved = resolveCssDeclarations(rules[0]!.declarations, [tokenCss, pageCss], "dark");
    assert.equal(resolved.background, "#101010");
  });
});

describe("parseCssCustomProperties", () => {
  it("collects light and dark scopes", () => {
    const scopes = parseCssCustomProperties(`
:root { --a: 1; }
[data-theme='dark'] { --a: 2; }
`);
    assert.equal(scopes.light["--a"], "1");
    assert.equal(scopes.dark["--a"], "2");
  });
});
