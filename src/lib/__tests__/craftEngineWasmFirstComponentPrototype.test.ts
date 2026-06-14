import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { defaultPrototypeLink } from "@/lib/prototype";

function baseRect(id: string) {
  return {
    id,
    parentId: null,
    type: "rectangle" as const,
    name: "Rect",
    x: 0,
    y: 0,
    width: 80,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  };
}

describe("craftEngineWasmFirstComponentPrototype", () => {
  it("updatePrototypeLink patches link fields", () => {
    const srcId = `frame-src-${Date.now()}`;
    const tgtId = `frame-tgt-${Date.now()}`;
    const link = defaultPrototypeLink(srcId, tgtId);
    useEditorStore.setState({
      nodes: {
        [srcId]: {
          id: srcId,
          parentId: null,
          type: "frame",
          name: "A",
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          prototypeLinks: [link],
        },
        [tgtId]: {
          id: tgtId,
          parentId: null,
          type: "frame",
          name: "B",
          x: 300,
          y: 0,
          width: 200,
          height: 200,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [srcId, tgtId] },
      selectedIds: [srcId],
    });
    useEditorStore.getState().updatePrototypeLink(link.id, { transition: "dissolve" });
    const links = useEditorStore.getState().nodes[srcId]?.prototypeLinks ?? [];
    assert.equal(links[0]?.transition, "dissolve");
  });

  it("deletePrototypeLink removes link from source node", () => {
    const srcId = `frame-del-${Date.now()}`;
    const tgtId = `frame-del2-${Date.now()}`;
    const link = defaultPrototypeLink(srcId, tgtId);
    useEditorStore.setState({
      nodes: {
        [srcId]: {
          id: srcId,
          parentId: null,
          type: "frame",
          name: "A",
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          prototypeLinks: [link],
        },
      },
      childOrder: { [ROOT]: [srcId] },
      selectedPrototypeLinkId: link.id,
    });
    useEditorStore.getState().deletePrototypeLink(link.id);
    assert.equal(useEditorStore.getState().nodes[srcId]?.prototypeLinks, undefined);
    assert.equal(useEditorStore.getState().selectedPrototypeLinkId, null);
  });

  it("updateInstanceOverride stores override on instance root", () => {
    const instId = `inst-${Date.now()}`;
    const childId = `child-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [instId]: {
          id: instId,
          parentId: null,
          type: "frame",
          name: "Instance",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          sourceComponentId: "master-1",
          componentId: "comp-1",
          instanceOverrides: {},
        },
        [childId]: {
          id: childId,
          parentId: instId,
          type: "rectangle",
          name: "Rect",
          x: 10,
          y: 10,
          width: 40,
          height: 30,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [instId], [instId]: [childId] },
    });
    useEditorStore.getState().updateInstanceOverride(instId, childId, { fill: "#ff0000" });
    const ovs = useEditorStore.getState().nodes[instId]?.instanceOverrides ?? {};
    assert.equal((ovs[childId] as { fill?: string })?.fill, "#ff0000");
  });

  it("deleteSingle removes node subtree", () => {
    const id = `rect-del-${Date.now()}`;
    useEditorStore.setState({
      nodes: { [id]: baseRect(id) },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().deleteSingle(id);
    assert.equal(useEditorStore.getState().nodes[id], undefined);
    assert.deepEqual(useEditorStore.getState().selectedIds, []);
  });
});
