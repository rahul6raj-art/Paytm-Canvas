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
});
