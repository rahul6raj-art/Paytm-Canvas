import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("craftEngineWasmFirstResponsivePreview", () => {
  it("openResponsivePreview captures geom backup and draft size", () => {
    const fid = `frame-rp-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [fid]: {
          id: fid,
          parentId: null,
          type: "frame",
          name: "Frame",
          x: 0,
          y: 0,
          width: 320,
          height: 240,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [fid] },
      responsivePreview: null,
    });
    useEditorStore.getState().openResponsivePreview(fid);
    const rp = useEditorStore.getState().responsivePreview;
    assert.equal(rp?.frameId, fid);
    assert.equal(rp?.draftWidth, 320);
    assert.equal(rp?.draftHeight, 240);
    assert.equal(rp?.geomBackup[fid]?.width, 320);
  });

  it("updateResponsivePreviewBounds resizes frame and constrained child", () => {
    const fid = `frame-rpb-${Date.now()}`;
    const cid = `child-rpb-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [fid]: {
          id: fid,
          parentId: null,
          type: "frame",
          name: "Frame",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
        [cid]: {
          id: cid,
          parentId: fid,
          type: "rectangle",
          name: "Child",
          x: 10,
          y: 10,
          width: 30,
          height: 30,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          constraintsHorizontal: "left-right",
          constraintsVertical: "top",
        },
      },
      childOrder: { [ROOT]: [fid], [fid]: [cid] },
      responsivePreview: null,
    });
    useEditorStore.getState().openResponsivePreview(fid);
    useEditorStore.getState().updateResponsivePreviewBounds(200, 100);
    assert.equal(useEditorStore.getState().nodes[fid]?.width, 200);
    assert.equal(useEditorStore.getState().nodes[cid]?.width, 130);
    assert.equal(useEditorStore.getState().responsivePreview?.draftWidth, 200);
  });

  it("cancelResponsivePreview restores original geometry", () => {
    const fid = `frame-rpc-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [fid]: {
          id: fid,
          parentId: null,
          type: "frame",
          name: "Frame",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      childOrder: { [ROOT]: [fid] },
      responsivePreview: null,
    });
    useEditorStore.getState().openResponsivePreview(fid);
    useEditorStore.getState().updateResponsivePreviewBounds(180, 120);
    useEditorStore.getState().cancelResponsivePreview();
    assert.equal(useEditorStore.getState().nodes[fid]?.width, 100);
    assert.equal(useEditorStore.getState().nodes[fid]?.height, 100);
    assert.equal(useEditorStore.getState().responsivePreview, null);
  });
});
