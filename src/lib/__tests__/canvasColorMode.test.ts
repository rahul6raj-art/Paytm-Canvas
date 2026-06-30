import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  colorTokenHasDarkMode,
  resolvedColorForMode,
  resolveNodeWithDesignTokens,
  applyImportedTokenColorsToNodes,
  type ColorTokenValue,
  type DesignToken,
} from "@/lib/designTokens";
import type { EditorNode } from "@/stores/useEditorStore";
import { isDesignColorModeSectionVisible } from "@/hooks/useDesignColorModeSectionVisible";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

describe("design color mode section visibility", () => {
  it("is hidden by default", () => {
    assert.equal(isDesignColorModeSectionVisible(null, {}), false);
  });

  it("shows when a code round-trip link exists", () => {
    const link: CodeRoundTripLink = {
      sourcePath: "src/App.tsx",
      repoRoot: "/repo",
      syncMode: "manual",
    };
    assert.equal(isDesignColorModeSectionVisible(link, {}), true);
  });

  it("shows when design tokens include dark-mode color stops", () => {
    const tokens: Record<string, DesignToken> = {
      bg: {
        id: "bg",
        name: "background",
        type: "color",
        value: { hex: "#fff", dark: { hex: "#000" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    assert.equal(isDesignColorModeSectionVisible(null, tokens), true);
  });
});

describe("canvas color mode tokens", () => {
  const tokenValue: ColorTokenValue = {
    hex: "#ffffff",
    dark: { hex: "#101010" },
  };

  it("resolves light and dark stops", () => {
    assert.equal(resolvedColorForMode(tokenValue, "light").hex, "#ffffff");
    assert.equal(resolvedColorForMode(tokenValue, "dark").hex, "#101010");
    assert.equal(colorTokenHasDarkMode(tokenValue), true);
  });

  it("applies active mode when resolving linked fill tokens", () => {
    const tokens: Record<string, DesignToken> = {
      "tok-bg": {
        id: "tok-bg",
        name: "background",
        type: "color",
        value: tokenValue,
        createdAt: "",
        updatedAt: "",
      },
    };
    const node: EditorNode = {
      id: "n1",
      type: "rect",
      name: "Box",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fillTokenId: "tok-bg",
      fill: "#cccccc",
    };
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "light").fill, "#ffffff");
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "dark").fill, "#101010");
  });

  it("resolves linked fillTokenId when baked fill is missing", () => {
    const tokens: Record<string, DesignToken> = {
      "css-var-surface-level-4": {
        id: "css-var-surface-level-4",
        name: "surface-level-4",
        type: "color",
        value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const node: EditorNode = {
      id: "card",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      fillTokenId: "css-var-surface-level-4",
      fillEnabled: true,
      codeClassName: "pml-more-theme-card",
    };
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "light").fill, "#f5f5f5");
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "dark").fill, "#101010");
  });

  it("applyImportedTokenColorsToNodes bakes light token colors after dark capture", () => {
    const tokens: Record<string, DesignToken> = {
      "tok-bg": {
        id: "tok-bg",
        name: "background-neutral-weak",
        type: "color",
        value: { hex: "#ebecee", dark: { hex: "#282828" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const nodes: Record<string, EditorNode> = {
      n1: {
        id: "n1",
        type: "rect",
        name: "Bg",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: "#282828",
        fillTokenId: "tok-bg",
      },
    };
    const out = applyImportedTokenColorsToNodes(nodes, tokens, "light");
    assert.equal(out.n1!.fill, "#ebecee");
  });

  it("resolveNodeWithDesignTokens resolves text color without persisted fillTokenId", () => {
    const tokens: Record<string, DesignToken> = {
      "tok-text": {
        id: "tok-text",
        name: "text-neutral-strong",
        type: "color",
        value: { hex: "#282828", dark: { hex: "#f5f5f5" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const node: EditorNode = {
      id: "t1",
      type: "text",
      name: "Label",
      x: 0,
      y: 0,
      width: 40,
      height: 16,
      content: "More",
      textColor: "#282828",
      fill: "#282828",
      codeClassName: "bn__label body-medium",
    };
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "dark").textColor, "#f5f5f5");
  });

  it("resolveNodeWithDesignTokens resolves card fill without persisted fillTokenId", () => {
    const pageCss = `.pml-more-theme-card { background: var(--surface-level-4); }`;
    const tokens: Record<string, DesignToken> = {
      "css-var-surface-level-4": {
        id: "css-var-surface-level-4",
        name: "surface-level-4",
        type: "color",
        value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const node: EditorNode = {
      id: "card",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      fill: "#101010",
      fillEnabled: true,
      codeClassName: "card pml-more-theme-card",
    };
    assert.equal(
      resolveNodeWithDesignTokens(node, tokens, "light", [pageCss]).fill,
      "#f5f5f5",
    );
    assert.equal(
      resolveNodeWithDesignTokens(node, tokens, "dark", [pageCss]).fill,
      "#101010",
    );
  });

  it("resolveNodeWithDesignTokens resolves linked card fillTokenId in dark mode", () => {
    const tokens: Record<string, DesignToken> = {
      "css-var-surface-level-1": {
        id: "css-var-surface-level-1",
        name: "surface-level-1",
        type: "color",
        value: { hex: "#f5f5f5", dark: { hex: "#101010" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const node: EditorNode = {
      id: "card",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      fill: "#f5f5f5",
      fillEnabled: true,
      fillTokenId: "css-var-surface-level-1",
      codeClassName: "pml-more-theme-card",
    };
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "light").fill, "#f5f5f5");
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "dark").fill, "#101010");
  });

  it("resolves card fill via semantic class when Card.css was not imported", () => {
    const tokens: Record<string, DesignToken> = {
      "css-var-surface-level-1": {
        id: "css-var-surface-level-1",
        name: "surface-level-1",
        type: "color",
        value: { hex: "#ffffff", dark: { hex: "#161616" } },
        createdAt: "",
        updatedAt: "",
      },
    };
    const node: EditorNode = {
      id: "card",
      type: "frame",
      name: "card",
      x: 0,
      y: 0,
      width: 344,
      height: 76,
      fill: "#ffffff",
      fillEnabled: true,
      codeClassName: "card pml-more-theme-card",
    };
    assert.equal(resolveNodeWithDesignTokens(node, tokens, "dark").fill, "#161616");
  });
});
