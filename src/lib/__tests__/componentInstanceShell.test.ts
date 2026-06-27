import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { markNodeAsComponent } from "@/lib/componentModel";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(
  id: string,
  parentId: string | null,
  opts?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: opts?.name ?? id,
    x: opts?.x ?? 0,
    y: opts?.y ?? 0,
    width: opts?.width ?? 120,
    height: opts?.height ?? 48,
    rotation: 0,
    visible: true,
    locked: false,
    fillEnabled: opts?.fillEnabled ?? false,
    ...opts,
  };
}

function text(id: string, parentId: string, content: string): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: content,
    x: 16,
    y: 12,
    width: 40,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    content,
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: 500,
    fill: "#111111",
    fillEnabled: true,
  };
}

describe("componentInstanceShell", () => {
  it("marks pass-through wrapper masters with content stable id", () => {
    const nodes: Record<string, EditorNode> = {
      shell: frame("shell", null, { name: "Div", width: 140, height: 56 }),
      btn: frame("btn", "shell", {
        name: "Button",
        codeClassName: "btn btn-primary",
        fill: "#0066ff",
        fillEnabled: true,
        cornerRadius: 8,
      }),
      label: text("label", "btn", "Go"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["shell"],
      shell: ["btn"],
      btn: ["label"],
    };

    const marked = markNodeAsComponent(nodes, childOrder, "shell");
    assert.equal(marked.shell?.componentInstanceContentStableId, marked.shell?.componentLayerStableIds?.btn);
  });

  it("unwraps shell frame when placing an instance on canvas", () => {
    let nodes: Record<string, EditorNode> = {
      shell: frame("shell", null, { name: "Div", width: 140, height: 56 }),
      btn: frame("btn", "shell", {
        name: "Button",
        codeClassName: "btn btn-primary",
        fill: "#0066ff",
        fillEnabled: true,
        cornerRadius: 8,
      }),
      label: text("label", "btn", "Go"),
    };
    let childOrder: Record<string, string[]> = {
      [EDITOR_ROOT_KEY]: ["shell"],
      shell: ["btn"],
      btn: ["label"],
    };

    nodes = markNodeAsComponent(nodes, childOrder, "shell");
    const masterId = "shell";

    const inst = buildInstanceFromMaster(nodes, childOrder, masterId, null, 200, 100);
    assert.ok(inst);
    const { newRootId } = inst!;
    const root = inst!.nodes[newRootId];
    assert.equal(root?.sourceComponentId, masterId);
    assert.notEqual(newRootId, inst!.nodes[masterId]?.id);
    assert.ok(inst!.nodes[newRootId]?.codeClassName?.includes("btn"));
    assert.equal(inst!.childOrder[EDITOR_ROOT_KEY]?.includes(newRootId), true);
    assert.equal(inst!.nodes[newRootId]?.parentId, null);

    const resolved = resolveComponentInstance(inst!.nodes, inst!.childOrder, newRootId, { force: true });
    assert.ok(resolved.nodes[newRootId]);
    assert.equal(resolved.nodes[newRootId]?.content ?? resolved.nodes.label?.content, "Go");
  });
});
