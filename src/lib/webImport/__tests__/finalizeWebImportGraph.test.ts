import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { finalizeWebImportGraph } from "../finalizeWebImportGraph";

function frame(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    clipChildren: true,
    ...extra,
  };
}

describe("finalizeWebImportGraph", () => {
  it("expands 1px-tall clip frames so children are not clipped away", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 500, 900),
      spacer: frame("spacer", "root", 0, 0, 500, 1, { clipChildren: true }),
      form: frame("form", "spacer", 0, 0, 500, 280, {
        layoutMode: "vertical",
        layoutGap: 16,
        clipChildren: true,
      }),
      field: frame("field", "form", 0, 0, 500, 68, { fill: "#f4f4f5", fillEnabled: true }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["spacer"],
      spacer: ["form"],
      form: ["field"],
    };

    const next = finalizeWebImportGraph(nodes, childOrder, 500, 900);
    assert.ok((next.spacer?.height ?? 0) >= 280);
    assert.ok((next.root?.height ?? 0) >= 280);
  });

  it("preserves child x/y positions instead of reflowing into auto-layout flow", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 80, 80, 720, 900, { layoutMode: "horizontal" }),
      left: frame("left", "root", 0, 0, 360, 900, { fill: "#fff", fillEnabled: true }),
      right: frame("right", "root", 360, 0, 360, 900, { fill: "#000", fillEnabled: true }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["left", "right"],
    };

    const next = finalizeWebImportGraph(nodes, childOrder, 720, 900);
    assert.equal(next.left?.x, 0);
    assert.equal(next.right?.x, 360);
  });

  it("does not push same-row horizontal siblings down as if they vertically overlap", () => {
    const nodes: Record<string, EditorNode> = {
      bar: frame("bar", null, 0, 0, 390, 44, { layoutMode: "horizontal" }),
      logo: frame("logo", "bar", 0, 6, 34, 34),
      title: {
        id: "title",
        parentId: "bar",
        type: "text",
        name: "Title",
        x: 42,
        y: 10,
        width: 40,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        content: "More",
        fontSize: 16,
        textResizeMode: "auto-height",
      },
      rhs: frame("rhs", "bar", 310, 2, 80, 40),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["bar"],
      bar: ["logo", "title", "rhs"],
    };

    const next = finalizeWebImportGraph(nodes, childOrder, 390, 844);
    assert.equal(next.title?.y, 10);
    assert.equal(next.rhs?.y, 2);
  });

  it("drops overlapping name fields when an email field occupies the same slot", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 500, 300, { layoutMode: "vertical", layoutGap: 0 }),
      names: frame("names", "root", 0, 0, 500, 172, { name: "Card" }),
      email: frame("email", "root", 0, 0, 500, 96, { name: "Input" }),
      first: {
        id: "first",
        parentId: "names",
        type: "text",
        name: "First Name",
        x: 0,
        y: 0,
        width: 120,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "First Name",
      },
      emailLabel: {
        id: "emailLabel",
        parentId: "email",
        type: "text",
        name: "Email",
        x: 0,
        y: 0,
        width: 120,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Email",
      },
      emailPh: {
        id: "emailPh",
        parentId: "email",
        type: "text",
        name: "Placeholder",
        x: 0,
        y: 28,
        width: 200,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Enter your email",
      },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["names", "email"],
      names: ["first"],
      email: ["emailLabel", "emailPh"],
    };

    finalizeWebImportGraph(nodes, childOrder, 500, 300);
    assert.equal(nodes.names, undefined);
    assert.equal(nodes.first, undefined);
    assert.deepEqual(childOrder.root, ["email"]);
  });

  it("preserves svg path children through finalize", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 500, 200),
      btn: frame("btn", "root", 0, 0, 500, 42, { name: "Continue with Google" }),
      icon: frame("icon", "btn", 157, 12, 18, 18, { name: "Svg" }),
      p1: {
        id: "p1",
        parentId: "icon",
        type: "path",
        name: "Vector",
        x: 1,
        y: 0,
        width: 14,
        height: 7,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#EA4335",
        fillEnabled: true,
      },
      p2: {
        id: "p2",
        parentId: "icon",
        type: "path",
        name: "Vector",
        x: 9,
        y: 8,
        width: 9,
        height: 8,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#4285F4",
        fillEnabled: true,
      },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["btn"],
      btn: ["icon"],
      icon: ["p1", "p2"],
    };

    finalizeWebImportGraph(nodes, childOrder, 500, 200);
    assert.equal(nodes.p1?.type, "path");
    assert.equal(nodes.p2?.type, "path");
    assert.deepEqual(childOrder.icon, ["p1", "p2"]);
  });

  it("preserves evenodd fill rule and clears phantom stroke on fill-only svg paths", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 100, 100),
      icon: {
        id: "icon",
        parentId: "root",
        type: "path",
        name: "home",
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#282828",
        fillEnabled: true,
        pathFillRule: "evenodd",
        pathClosed: true,
        strokeEnabled: true,
        strokeWidth: 2,
        strokeColor: "#000000",
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["icon"] };

    finalizeWebImportGraph(nodes, childOrder, 100, 100);
    assert.equal(nodes.icon?.pathFillRule, "evenodd");
    assert.equal(nodes.icon?.strokeEnabled, false);
    assert.equal(nodes.icon?.strokeWidth, 0);
  });

  it("expands clipped section titles when line-height is a unitless ratio", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 200, 80),
      title: {
        id: "title",
        parentId: "root",
        type: "text",
        name: "Section title",
        x: 0,
        y: 0,
        width: 90,
        height: 28,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Appearance",
        fontSize: 22,
        lineHeight: 1.2727272727272727,
        fill: "#282828",
        fillEnabled: true,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["title"] };

    finalizeWebImportGraph(nodes, childOrder, 200, 80);
    // Captured DOM box (90px) is far narrower than the measured glyph run, so the box must
    // grow to fit "Appearance" instead of clipping it.
    assert.ok((nodes.title?.width ?? 0) > 90);
    assert.equal(nodes.title?.textResizeMode, "auto-width");
  });

  it("does not reflow overlapping svg icon subpaths inside an Svg frame", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 24, 24),
      svg: frame("svg", "root", 0, 0, 24, 24, { name: "Svg" }),
      house: {
        id: "house",
        parentId: "svg",
        type: "path",
        name: "house",
        x: 1.15,
        y: 1.7,
        width: 21.7,
        height: 20.3,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#282828",
        fillEnabled: true,
        pathClosed: true,
      },
      chimney: {
        id: "chimney",
        parentId: "svg",
        type: "path",
        name: "chimney",
        x: 9.97,
        y: 7.6,
        width: 4.07,
        height: 1.82,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#282828",
        fillEnabled: true,
        pathClosed: true,
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["svg"], svg: ["house", "chimney"] };

    finalizeWebImportGraph(nodes, childOrder, 24, 24);
    assert.ok((nodes.chimney?.y ?? 0) < 10);
  });

  it("preserves single-child card wrappers with card styling", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 360, 200),
      card: frame("card", "root", 16, 72, 328, 76, {
        name: "Card",
        codeClassName: "card pml-more-theme-card",
        fill: "#ffffff",
        fillEnabled: true,
        cornerRadius: 24,
      }),
      row: frame("row", "card", 16, 24, 296, 28, {
        name: "pml-more-theme-card__row",
        fillEnabled: false,
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["card"], card: ["row"] };

    finalizeWebImportGraph(nodes, childOrder, 360, 200);
    assert.ok(nodes.card);
    assert.equal(nodes.row?.parentId, "card");
    assert.equal(nodes.card?.cornerRadius, 24);
    assert.equal(nodes.card?.height, 76);
  });

  it("does not trim card height when bottom padding is below children", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 360, 200),
      card: frame("card", "root", 16, 72, 328, 76, {
        name: "Card",
        codeClassName: "card pml-more-theme-card",
        fill: "#ffffff",
        fillEnabled: true,
        cornerRadius: 24,
        paddingBottom: 24,
      }),
      row: frame("row", "card", 16, 24, 296, 28, {
        name: "pml-more-theme-card__row",
        fillEnabled: false,
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["card"], card: ["row"] };

    finalizeWebImportGraph(nodes, childOrder, 360, 200);
    assert.equal(nodes.card?.height, 76);
  });

  it("collapses single-child Div wrappers", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 500, 400),
      outer: frame("outer", "root", 0, 0, 500, 400, { name: "Div", fillEnabled: false }),
      inner: frame("inner", "outer", 0, 0, 500, 400, {
        name: "Div",
        fill: "#ffffff",
        fillEnabled: true,
        clipChildren: false,
      }),
      btn: frame("btn", "inner", 10, 20, 200, 40, {
        name: "Continue with Email",
        fill: "#0d44bf",
        fillEnabled: true,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["outer"],
      outer: ["inner"],
      inner: ["btn"],
    };

    finalizeWebImportGraph(nodes, childOrder, 500, 400);
    assert.equal(nodes.outer, undefined);
    assert.equal(nodes.inner, undefined);
    assert.equal(nodes.btn?.parentId, "root");
    assert.equal(nodes.btn?.x, 10);
    assert.equal(nodes.btn?.y, 20);
    assert.deepEqual(childOrder.root, ["btn"]);
  });

  it("expands narrow imported text labels and recenters center-aligned copy", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 390, 844),
      label: {
        id: "label",
        parentId: "root",
        type: "text",
        name: "Label",
        x: 40,
        y: 100,
        width: 18,
        height: 16,
        rotation: 0,
        visible: true,
        locked: false,
        content: "More",
        fontFamily: "Inter, sans-serif",
        fontSize: 12,
        fontWeight: 400,
        textAlign: "center",
        textResizeMode: "fixed",
      },
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"], root: ["label"] };

    finalizeWebImportGraph(nodes, childOrder, 390, 844);
    // Captured box (18px) is far narrower than "More" — it must expand to fit, not clip.
    assert.ok((nodes.label?.width ?? 0) > 18);
    assert.equal(nodes.label?.content, "More");
    assert.equal(nodes.label?.x, 40);
  });

  it("disables clip on parents of overflowing glow layers", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, 390, 844),
      wrap: frame("wrap", "root", 100, 200, 32, 32, { clipChildren: true, name: "Icon wrap" }),
      glow: frame("glow", "wrap", -14, -14, 60, 60, {
        fillGradient: {
          kind: "radial",
          stops: [{ id: "s1", color: "#00ff00", opacity: 0.4, position: 0 }],
        },
        fillEnabled: true,
        name: "Glow",
      }),
      icon: frame("icon", "wrap", 4, 4, 24, 24, { name: "SVG" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["wrap"],
      wrap: ["glow", "icon"],
    };

    finalizeWebImportGraph(nodes, childOrder, 390, 844);
    assert.equal(nodes.wrap?.clipChildren, false);
  });

  it("bridgeCapture preserves captured text bounds and section inset", () => {
    const nodes: Record<string, EditorNode> = {
      screen: frame("screen", null, 0, 0, 376, 844, { codeClassName: "pml-more" }),
      section: frame("section", "screen", 16, 120, 344, 200, { codeClassName: "sh-section" }),
      card: frame("card", "section", 0, 56, 344, 96, { codeClassName: "card" }),
      label: {
        id: "label",
        parentId: "card",
        type: "text",
        name: "Dark theme",
        x: 16,
        y: 16,
        width: 92,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Dark theme",
        fontSize: 16,
      },
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["screen"],
      screen: ["section"],
      section: ["card"],
      card: ["label"],
    };

    finalizeWebImportGraph(nodes, childOrder, 376, 844, { bridgeCapture: true });
    assert.equal(nodes.section?.x, 16);
    assert.equal(nodes.label?.width, 92);
    assert.equal(nodes.label?.x, 16);
  });
});
