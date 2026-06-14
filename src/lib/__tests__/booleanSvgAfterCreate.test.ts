import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { applyAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function rect(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  extra: Partial<EditorNode> = {},
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name: id,
    x,
    y,
    width: 80,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#3366ff",
    fillEnabled: true,
    strokePosition: "center",
    ...extra,
  } as EditorNode;
}

describe("boolean SVG after createBooleanGroup", () => {
  it("renders union boolean at root", () => {
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [a]: rect(a, null, 0, 0), [b]: rect(b, null, 40, 20) },
      childOrder: { [ROOT]: [a, b] },
      selectedIds: [a, b],
    });
    useEditorStore.getState().createBooleanGroup("union");
    const st = useEditorStore.getState();
    const gid = st.selectedIds[0]!;
    assert.ok(st.nodes[gid]?.isBooleanGroup);

    const scene = buildSvgScene({
      rootIds: st.childOrder[EDITOR_ROOT_KEY] ?? st.childOrder[ROOT] ?? [],
      nodes: st.nodes,
      childOrder: st.childOrder,
    });
    assert.match(scene.body, /<path d="/);
    assert.equal((scene.body.match(/<rect /g) ?? []).length, 0);
  });

  it("renders union boolean inside a frame", () => {
    const f = `frame-${Date.now()}`;
    const a = `rect-a-${Date.now()}`;
    const b = `rect-b-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [f]: {
          id: f,
          parentId: null,
          type: "frame",
          name: "Frame",
          x: 100,
          y: 50,
          width: 300,
          height: 200,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          layoutMode: "none",
          fillEnabled: true,
          fill: "#ffffff",
          strokePosition: "center",
        } as EditorNode,
        [a]: rect(a, f, 10, 10),
        [b]: rect(b, f, 50, 30),
      },
      childOrder: { [ROOT]: [f], [f]: [a, b] },
      selectedIds: [a, b],
    });
    useEditorStore.getState().createBooleanGroup("union");
    const st = useEditorStore.getState();
    const gid = st.selectedIds[0]!;
    assert.equal(st.nodes[gid]?.parentId, f);

    const scene = buildSvgScene({
      rootIds: st.childOrder[ROOT] ?? [],
      nodes: st.nodes,
      childOrder: st.childOrder,
    });
    assert.match(scene.body, /<path d="/);
    assert.ok(scene.body.length > 0);
  });

  it("renders boolean inside auto-layout frame with stale childOrder on operands", () => {
    const nodes: Record<string, EditorNode> = {
      a: rect("a", null, 0, 0),
      b: rect("b", null, 50, 0),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["a", "b"] };
    const layout = applyAutoLayoutToSelection(nodes, childOrder, ["a", "b"]);
    assert.ok(layout);
    const f = layout!.selectedIds[0]!;
    const kids = layout!.childOrder[f] ?? [];
    assert.equal(kids.length, 2);

    useEditorStore.setState({
      nodes: layout!.nodes,
      childOrder: {
        ...layout!.childOrder,
        [f]: [],
        [EDITOR_ROOT_KEY]: [f, ...kids],
      },
      selectedIds: kids,
    });
    useEditorStore.getState().createBooleanGroup("union");
    const st = useEditorStore.getState();
    const gid = st.selectedIds[0]!;
    assert.ok(st.nodes[gid]?.isBooleanGroup);

    const scene = buildSvgScene({
      rootIds: st.childOrder[ROOT] ?? [],
      nodes: st.nodes,
      childOrder: st.childOrder,
    });
    assert.match(
      scene.body,
      /<path d="/,
      `boolean should render composite path, body=${scene.body.slice(0, 200)}`,
    );
  });
});
