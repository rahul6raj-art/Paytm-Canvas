import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EditorNode } from "@/stores/useEditorStore";
import { pickTextColorTokenId } from "@/lib/colorTokenMatching";
import {
  projectDesignTokensFromCssSources,
  projectDesignTokensWithColorModesFromCssSources,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import { tokenizeImportedNodes } from "@/lib/craftBridge/tokenizeImportedNodes";

const COLOR_CSS = `
:root {
  --text-neutral-strong: #282828;
  --surface-level-4: #F5F5F5;
  --background-neutral-weak: #EBECEE;
}
`;

const DUAL_THEME_CSS = `
:root {
  --text-neutral-strong: #282828;
  --background-neutral-weak: #EBECEE;
  --surface-level-1: #FFFFFF;
  --surface-level-4: #F5F5F5;
}
[data-theme='dark'] {
  --text-neutral-strong: #F5F5F5;
  --background-neutral-weak: #282828;
  --surface-level-1: #101010;
  --surface-level-4: #101010;
}
`;

const PAGE_CSS = `
.pml-more-theme-card {
  background: var(--surface-level-4);
}
.bn_bar {
  background: var(--surface-level-1);
}
`;

const TYPO_CSS = `
:root { --font-size-body: 14px; --line-height-body: 20px; }
.body-medium {
  font-family: Inter, sans-serif;
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  font-weight: 500;
}
`;

const SPACING_CSS = `
:root {
  --spacing-16: 16px;
  --spacing-24: 24px;
}
`;

describe("tokenizeImportedNodes", () => {
  it("binds fill and text layers to matching project color tokens", () => {
    const tokens = projectDesignTokensFromCssSources([COLOR_CSS], "light");
    const nodes: Record<string, EditorNode> = {
      bg: {
        id: "bg",
        parentId: null,
        type: "frame",
        name: "bg",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: "#f5f5f5",
        fillEnabled: true,
      },
      label: {
        id: "label",
        parentId: "bg",
        type: "text",
        name: "label",
        x: 0,
        y: 0,
        width: 80,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Hello",
        textColor: "#282828",
        codeClassName: "body-medium",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.4285714285714286,
        letterSpacing: 0,
      },
    };

    const out = tokenizeImportedNodes(nodes, tokens);
    assert.equal(out.bg!.fillTokenId, "css-var-surface-level-4");
    assert.equal(out.label!.fillTokenId, "css-var-text-neutral-strong");
  });

  it("binds typography utility classes from codeClassName", () => {
    const tokens = projectDesignTokensFromCssSources([TYPO_CSS], "light");
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: null,
        type: "text",
        name: "label",
        x: 0,
        y: 0,
        width: 80,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Hello",
        codeClassName: "body-medium sh__title",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 20 / 14,
        letterSpacing: 0,
      },
    };
    const out = tokenizeImportedNodes(nodes, tokens);
    assert.equal(out.label!.textStyleTokenId, "css-type-body-medium");
  });

  it("binds frame spacing values to spacing tokens", () => {
    const tokens = projectDesignTokensFromCssSources([SPACING_CSS], "light");
    const nodes: Record<string, EditorNode> = {
      card: {
        id: "card",
        parentId: null,
        type: "frame",
        name: "card",
        x: 0,
        y: 0,
        width: 344,
        height: 76,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        paddingTop: 24,
        paddingRight: 16,
        paddingBottom: 24,
        paddingLeft: 16,
        layoutGap: 16,
      },
    };
    const out = tokenizeImportedNodes(nodes, tokens);
    assert.equal(out.card!.projectSpacingTokenIds?.paddingTop, "css-var-spacing-24");
    assert.equal(out.card!.projectSpacingTokenIds?.paddingRight, "css-var-spacing-16");
    assert.equal(out.card!.projectSpacingTokenIds?.layoutGap, "css-var-spacing-16");
  });

  it("prefers light-stop tokens when importMode is light (avoids dark-stop collisions)", () => {
    const tokens = projectDesignTokensWithColorModesFromCssSources([DUAL_THEME_CSS]);
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: null,
        type: "text",
        name: "label",
        x: 0,
        y: 0,
        width: 80,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content: "Title",
        textColor: "#282828",
      },
    };
    const out = tokenizeImportedNodes(nodes, tokens, { importMode: "light" });
    assert.equal(out.label!.fillTokenId, "css-var-text-neutral-strong");
  });

  it("binds fills from page CSS var() via codeClassName", () => {
    const tokens = projectDesignTokensWithColorModesFromCssSources([DUAL_THEME_CSS, PAGE_CSS]);
    const nodes: Record<string, EditorNode> = {
      card: {
        id: "card",
        parentId: null,
        type: "frame",
        name: "card",
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: "#101010",
        fillEnabled: true,
        codeClassName: "pml-more-theme-card",
      },
      nav: {
        id: "nav",
        parentId: null,
        type: "frame",
        name: "nav",
        x: 0,
        y: 0,
        width: 100,
        height: 56,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: "#ffffff",
        fillEnabled: true,
        codeClassName: "bn_bar",
      },
    };
    const out = tokenizeImportedNodes(nodes, tokens, {
      importMode: "light",
      cssSources: [PAGE_CSS, DUAL_THEME_CSS],
    });
    assert.equal(out.card!.fillTokenId, "css-var-surface-level-4");
    assert.equal(out.nav!.fillTokenId, "css-var-surface-level-1");
    assert.equal(
      pickTextColorTokenId(
        { codeClassName: "bn_bar", fill: "#ffffff", fillTokenId: undefined },
        tokens,
        [PAGE_CSS],
        "light",
      ),
      "css-var-surface-level-1",
    );
  });
});
