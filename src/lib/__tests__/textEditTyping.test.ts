import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY, useEditorStore } from "@/stores/useEditorStore";
import { mergeInstanceOverrides } from "@/lib/componentModel";
import { markNodeAsComponent } from "@/lib/componentModel";
import { buildInstanceFromMaster } from "@/lib/components/componentActions";
import { createTextProperty } from "@/lib/components/properties";

describe("canvas text typing store path", () => {
  it("plain text content persists across rapid updates", () => {
    useEditorStore.setState({
      nodes: {
        root: {
          id: "root",
          type: "frame",
          name: "Page",
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          parentId: null,
          visible: true,
          locked: false,
        },
        t1: {
          id: "t1",
          type: "text",
          name: "Text",
          x: 100,
          y: 100,
          width: 200,
          height: 40,
          parentId: "root",
          visible: true,
          locked: false,
          content: "",
          fontSize: 16,
          fontFamily: "Inter",
          fontWeight: 400,
        },
      },
      childOrder: { root: ["t1"], [EDITOR_ROOT_KEY]: ["root"] },
    });
    for (const c of ["a", "ab", "abc", "abcd"]) {
      useEditorStore.getState().updateNodeStyle("t1", { content: c }, { skipHistory: true });
      assert.equal(useEditorStore.getState().nodes.t1?.content, c);
    }
  });

  it("instance text override persists across rapid updates", () => {
    let nodes = {
      master: {
        id: "master",
        type: "frame" as const,
        name: "Btn",
        x: 0,
        y: 0,
        width: 120,
        height: 48,
        parentId: null,
        visible: true,
        locked: false,
        isComponent: true,
        componentId: "cmp-1",
      },
      label: {
        id: "label",
        type: "text" as const,
        name: "Label",
        x: 8,
        y: 12,
        width: 80,
        height: 24,
        parentId: "master",
        visible: true,
        locked: false,
        content: "Go",
        fontSize: 14,
        fontFamily: "Inter",
        fontWeight: 500,
      },
    };
    const childOrder = { master: ["label"], [EDITOR_ROOT_KEY]: ["master"] };
    nodes = markNodeAsComponent(nodes, childOrder, "master");
    const labelStable = nodes.master!.componentLayerStableIds!.label!;
    nodes = {
      ...nodes,
      master: {
        ...nodes.master!,
        componentPropertyDefs: [createTextProperty("label", "Label", labelStable, "Go")],
      },
    };
    const inst = buildInstanceFromMaster(nodes, childOrder, "master", { x: 200, y: 0 });
    assert.ok(inst);
    useEditorStore.setState({ nodes: inst.nodes, childOrder: inst.childOrder });
    const labelId = Object.keys(inst.nodes).find(
      (id) => inst.nodes[id]?.type === "text" && id !== "label",
    );
    assert.ok(labelId);
    for (const c of ["G", "Go", "Goo", "Good"]) {
      useEditorStore.getState().updateNodeStyle(labelId!, { content: c }, { skipHistory: true });
      const st = useEditorStore.getState();
      const merged = mergeInstanceOverrides(st.nodes[labelId!]!, st.nodes);
      assert.equal(merged.content, c, `expected ${c} after typing`);
    }
  });

  it("instance with bound text property allows canvas override beyond property value length", () => {
    let nodes = {
      master: {
        id: "master",
        type: "frame" as const,
        name: "Btn",
        x: 0,
        y: 0,
        width: 120,
        height: 48,
        parentId: null,
        visible: true,
        locked: false,
        isComponent: true,
        componentId: "cmp-2",
      },
      label: {
        id: "label",
        type: "text" as const,
        name: "Label",
        x: 8,
        y: 12,
        width: 80,
        height: 24,
        parentId: "master",
        visible: true,
        locked: false,
        content: "Go",
        fontSize: 14,
        fontFamily: "Inter",
        fontWeight: 500,
      },
    };
    const childOrder = { master: ["label"], [EDITOR_ROOT_KEY]: ["master"] };
    nodes = markNodeAsComponent(nodes, childOrder, "master");
    const labelStable = nodes.master!.componentLayerStableIds!.label!;
    nodes = {
      ...nodes,
      master: {
        ...nodes.master!,
        componentPropertyDefs: [createTextProperty("label", "Label", labelStable, "Go")],
      },
    };
    const inst = buildInstanceFromMaster(nodes, childOrder, "master", { x: 200, y: 0 });
    assert.ok(inst);
    const instRootId = inst.newRootId;
    useEditorStore.getState().setComponentPropertyValue(instRootId, "label", "Go");
    const labelId = Object.keys(useEditorStore.getState().nodes).find(
      (id) =>
        useEditorStore.getState().nodes[id]?.type === "text" && id !== "label" && id !== instRootId,
    );
    assert.ok(labelId);
    useEditorStore.getState().updateNodeStyle(labelId!, { content: "Good" }, { skipHistory: true });
    const st = useEditorStore.getState();
    const merged = mergeInstanceOverrides(st.nodes[labelId!]!, st.nodes);
    assert.equal(merged.content, "Good");
  });
});
