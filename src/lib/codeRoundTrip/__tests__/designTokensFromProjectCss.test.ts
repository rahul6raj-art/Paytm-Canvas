import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cssVarDisplayName,
  cssVarTokenId,
  designTokensFromProjectCss,
  projectDesignTokensWithColorModesFromCssSources,
} from "../designTokensFromProjectCss";

const SAMPLE = `
:root {
  --background-neutral-weak: #EBECEE;
  --surface-level-4: var(--primitive-mono-100);
  --primitive-mono-100: #F5F5F5;
  --text-primary-strong: var(--primitive-actions-primary);
  --primitive-actions-primary: #0088FF;
}
[data-theme='dark'] {
  --background-neutral-weak: #282828;
  --surface-level-4: #101010;
}
`;

describe("designTokensFromProjectCss", () => {
  it("creates color tokens using CSS variable names from code", () => {
    const tokens = designTokensFromProjectCss([SAMPLE], "light");
    assert.ok(tokens["css-var-background-neutral-weak"]);
    assert.equal(
      tokens["css-var-background-neutral-weak"]!.name,
      "background-neutral-weak",
    );
    assert.equal(tokens["css-var-background-neutral-weak"]!.value.hex, "#ebecee");
  });

  it("resolves var() chains before parsing colors", () => {
    const tokens = designTokensFromProjectCss([SAMPLE], "light");
    assert.equal(tokens["css-var-surface-level-4"]!.value.hex, "#f5f5f5");
    assert.equal(tokens["css-var-text-primary-strong"]!.value.hex, "#0088ff");
  });

  it("uses dark theme overrides when requested", () => {
    const tokens = designTokensFromProjectCss([SAMPLE], "dark");
    assert.equal(tokens["css-var-background-neutral-weak"]!.value.hex, "#282828");
    assert.equal(tokens["css-var-surface-level-4"]!.value.hex, "#101010");
  });

  it("imports both light and dark values into one token", () => {
    const tokens = projectDesignTokensWithColorModesFromCssSources([SAMPLE]);
    const bg = tokens["css-var-background-neutral-weak"]!.value;
    assert.equal(bg.hex, "#ebecee");
    assert.equal(bg.dark?.hex, "#282828");
    assert.equal(tokens["css-var-surface-level-4"]!.value.dark?.hex, "#101010");
  });

  it("maps css var helpers consistently", () => {
    assert.equal(cssVarDisplayName("--brand-blue"), "brand-blue");
    assert.equal(cssVarTokenId("--brand-blue"), "css-var-brand-blue");
  });
});
