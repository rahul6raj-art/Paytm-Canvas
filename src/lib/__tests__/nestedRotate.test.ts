import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { repairNodeHierarchy } from "@/lib/editorGraph";
import {
  applyMultiRotatePatches,
  applySingleRotate,
  createMultiRotateSession,
  createSingleRotateSession,
  getNodeWorldCenterFromChildOrder,
  unionBoundsCenter,
} from "@/lib/rotation";
import { rotatePointAroundCenter } from "@/lib/transformMath";
import { ROOT, useEditorStore, type EditorNode } from "@/stores/useEditorStore";

function rect(partial: Partial<EditorNode> & Pick<EditorNode, "id">): EditorNode {
  return {
    parentId: null,
    type: "rectangle",
    name: "Rect",
    x: 100,
    y: 80,
    width: 120,
    height: 60,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    ...partial,
  };
}

function container(type: "frame" | "group", id: string, partial: Partial<EditorNode> = {}): EditorNode {
  return rect({ id, type, ...partial });
}

describe("nested rotation", () => {
  it("applySingleRotate preserves child world center inside rotated frame", () => {
    const nodes = {
      frame: container("frame", "frame", { rotation: 25, width: 400, height: 300, x: 50, y: 40 }),
      child: rect({ id: "child", parentId: "frame", x: 60, y: 70, width: 80, height: 40, rotation: 10 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["child"] };
    const beforeCenter = getNodeWorldCenterFromChildOrder("child", nodes, childOrder);
    const session = createSingleRotateSession(
      "child",
      nodes.child,
      nodes,
      childOrder,
      { x: beforeCenter.x + 120, y: beforeCenter.y },
    );
    const { rotation, x, y } = applySingleRotate(
      session,
      { x: beforeCenter.x, y: beforeCenter.y + 120 },
      false,
      nodes,
      childOrder,
    );
    assert.equal(x, 60);
    assert.equal(y, 70);
    const afterNodes = { ...nodes, child: { ...nodes.child, rotation, x, y } };
    const afterCenter = getNodeWorldCenterFromChildOrder("child", afterNodes, childOrder);
    assert.ok(Math.abs(afterCenter.x - beforeCenter.x) < 0.02);
    assert.ok(Math.abs(afterCenter.y - beforeCenter.y) < 0.02);
    assert.equal(afterNodes.child.width, 80);
    assert.equal(afterNodes.child.height, 40);
  });

  it("rotating parent frame keeps child local geometry unchanged", () => {
    const nodes = {
      frame: container("frame", "frame", { rotation: 0, width: 300, height: 200, x: 100, y: 100 }),
      child: rect({ id: "child", parentId: "frame", x: 30, y: 40, width: 50, height: 30, rotation: 15 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["child"] };
    const childBefore = { ...nodes.child };
    const session = createSingleRotateSession(
      "frame",
      nodes.frame,
      nodes,
      childOrder,
      { x: 250, y: 100 },
    );
    const { rotation, x, y } = applySingleRotate(
      session,
      { x: 250, y: 250 },
      false,
      nodes,
      childOrder,
    );
    const afterNodes = {
      ...nodes,
      frame: { ...nodes.frame, rotation, x, y },
    };
    const childAfter = afterNodes.child;
    assert.equal(childAfter.x, childBefore.x);
    assert.equal(childAfter.y, childBefore.y);
    assert.equal(childAfter.width, childBefore.width);
    assert.equal(childAfter.height, childBefore.height);
    assert.equal(childAfter.rotation, childBefore.rotation);
  });

  it("store updateNode keeps nested child geometry fixed during rotate drag", () => {
    const childId = `nested-child-${Date.now()}`;
    const frameId = `nested-frame-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [frameId]: container("frame", frameId, { x: 80, y: 60, width: 320, height: 240, rotation: 20 }),
        [childId]: rect({
          id: childId,
          parentId: frameId,
          x: 40,
          y: 50,
          width: 90,
          height: 45,
          rotation: 5,
        }),
      },
      childOrder: { [ROOT]: [frameId], [frameId]: [childId] },
      transformInteractionMode: "none",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: null,
    });
    const childOrder = useEditorStore.getState().childOrder;
    const beforeCenter = getNodeWorldCenterFromChildOrder(
      childId,
      useEditorStore.getState().nodes,
      childOrder,
    );
    useEditorStore.getState().beginRotateInteraction(childId, {
      x: 40,
      y: 50,
      width: 90,
      height: 45,
    });
    for (const rotation of [20, 55, 90]) {
      useEditorStore.getState().updateNode(childId, { rotation, x: 40, y: 50 }, { skipHistory: true });
      const n = useEditorStore.getState().nodes[childId];
      assert.equal(n?.x, 40);
      assert.equal(n?.y, 50);
      assert.equal(n?.width, 90);
      assert.equal(n?.height, 45);
    }
    useEditorStore.getState().endRotateInteraction(childId, 90);
    const after = useEditorStore.getState().nodes[childId];
    const afterCenter = getNodeWorldCenterFromChildOrder(
      childId,
      useEditorStore.getState().nodes,
      childOrder,
    );
    assert.ok(Math.abs(afterCenter.x - beforeCenter.x) < 0.05);
    assert.ok(Math.abs(afterCenter.y - beforeCenter.y) < 0.05);
    assert.equal(after?.width, 90);
    assert.equal(after?.height, 45);
  });

  it("store rotating parent frame does not rewrite child local geometry", () => {
    const childId = `parent-rot-child-${Date.now()}`;
    const groupId = `parent-rot-group-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [groupId]: container("group", groupId, { x: 120, y: 90, width: 260, height: 180, rotation: 0 }),
        [childId]: rect({
          id: childId,
          parentId: groupId,
          x: 25,
          y: 35,
          width: 70,
          height: 35,
          rotation: 12,
        }),
      },
      childOrder: { [ROOT]: [groupId], [groupId]: [childId] },
      transformInteractionMode: "none",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: null,
    });
    const childBefore = { ...useEditorStore.getState().nodes[childId]! };
    useEditorStore.getState().beginRotateInteraction(groupId, {
      x: 120,
      y: 90,
      width: 260,
      height: 180,
    });
    useEditorStore.getState().updateNode(groupId, { rotation: 40, x: 120, y: 90 }, { skipHistory: true });
    useEditorStore.getState().endRotateInteraction(groupId, 40);
    const childAfter = useEditorStore.getState().nodes[childId];
    assert.equal(childAfter?.x, childBefore.x);
    assert.equal(childAfter?.y, childBefore.y);
    assert.equal(childAfter?.width, childBefore.width);
    assert.equal(childAfter?.height, childBefore.height);
    assert.equal(childAfter?.rotation, childBefore.rotation);
  });

  it("repairNodeHierarchy does not corrupt children after parent group rotation", () => {
    const groupId = "group";
    const childId = "child";
    const child = rect({ id: childId, parentId: groupId, x: 25, y: 35, width: 70, height: 35, rotation: 0 });
    const nodes = {
      [groupId]: container("group", groupId, { x: 120, y: 90, width: 260, height: 180, rotation: 40 }),
      [childId]: child,
    };
    const childOrder = { [EDITOR_ROOT_KEY]: [groupId], [groupId]: [childId] };
    const fixed = repairNodeHierarchy(nodes, childOrder);
    assert.equal(fixed.nodes[childId]!.x, child.x);
    assert.equal(fixed.nodes[childId]!.y, child.y);
    assert.equal(fixed.nodes[childId]!.width, child.width);
    assert.equal(fixed.nodes[childId]!.height, child.height);
  });

  it("endMultiRotateInteraction clears rotate mode and preserves nested geometry", () => {
    const a = `multi-a-${Date.now()}`;
    const b = `multi-b-${Date.now()}`;
    const frameId = `multi-frame-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [frameId]: container("frame", frameId, { x: 0, y: 0, width: 400, height: 300, rotation: 15 }),
        [a]: rect({ id: a, parentId: frameId, x: 20, y: 30, width: 50, height: 30, rotation: 0 }),
        [b]: rect({ id: b, parentId: frameId, x: 120, y: 40, width: 60, height: 35, rotation: 5 }),
      },
      childOrder: { [ROOT]: [frameId], [frameId]: [a, b] },
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: {
        [a]: { x: 20, y: 30, width: 50, height: 30 },
        [b]: { x: 120, y: 40, width: 60, height: 35 },
      },
    });
    useEditorStore.getState().updateNodes(
      {
        [a]: { rotation: 20, x: 25, y: 32 },
        [b]: { rotation: 25, x: 125, y: 42 },
      },
      { skipHistory: true },
    );
    useEditorStore.getState().endMultiRotateInteraction();
    const st = useEditorStore.getState();
    assert.equal(st.transformInteractionMode, "none");
    assert.equal(st.rotateGeomSnapshots, null);
    assert.equal(st.nodes[a]?.width, 50);
    assert.equal(st.nodes[b]?.height, 35);
    assert.equal(st.nodes[a]?.rotation, 20);
  });

  it("applyMultiRotatePatches preserves sizes for children inside rotated frame", () => {
    const nodes = {
      frame: container("frame", "frame", { rotation: 30, x: 0, y: 0, width: 500, height: 400 }),
      a: rect({ id: "a", parentId: "frame", x: 40, y: 50, width: 60, height: 30, rotation: 0 }),
      b: rect({ id: "b", parentId: "frame", x: 140, y: 80, width: 80, height: 40, rotation: 15 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["a", "b"] };
    const union = { x: 0, y: 0, width: 300, height: 200 };
    const session = createMultiRotateSession(["a", "b"], nodes, childOrder, union, { x: 150, y: -50 });
    const patches = applyMultiRotatePatches(
      session,
      { x: 250, y: 150 },
      false,
      nodes,
      childOrder,
    );
    assert.equal(nodes.a!.width, 60);
    assert.equal(nodes.b!.width, 80);
    const afterNodes = {
      ...nodes,
      a: { ...nodes.a!, ...patches.a! },
      b: { ...nodes.b!, ...patches.b! },
    };
    assert.equal(afterNodes.a.width, 60);
    assert.equal(afterNodes.a.height, 30);
    assert.equal(afterNodes.b.width, 80);
    assert.equal(afterNodes.b.height, 40);
  });

  it("applyMultiRotatePatches preserves orbited world center for nested child", () => {
    const nodes = {
      frame: container("frame", "frame", { rotation: 25, x: 50, y: 40, width: 400, height: 300 }),
      child: rect({ id: "child", parentId: "frame", x: 60, y: 70, width: 80, height: 40, rotation: 10 }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["frame"], frame: ["child"] };
    const union = { x: 0, y: 0, width: 200, height: 200 };
    const session = createMultiRotateSession(["child"], nodes, childOrder, union, { x: 100, y: -50 });
    const startCenter = session.items[0]!.startWorldCenter;
    const patches = applyMultiRotatePatches(
      session,
      { x: 200, y: 100 },
      false,
      nodes,
      childOrder,
    );
    const afterNodes = { ...nodes, child: { ...nodes.child, ...patches.child! } };
    const afterCenter = getNodeWorldCenterFromChildOrder("child", afterNodes, childOrder);
    const expected = rotatePointAroundCenter(
      startCenter,
      unionBoundsCenter(union),
      session.accumulatedDeltaDeg,
    );
    assert.ok(Math.abs(afterCenter.x - expected.x) < 0.05, `x drift ${afterCenter.x} vs ${expected.x}`);
    assert.ok(Math.abs(afterCenter.y - expected.y) < 0.05, `y drift ${afterCenter.y} vs ${expected.y}`);
    assert.equal(afterNodes.child.width, 80);
    assert.equal(afterNodes.child.height, 40);
  });
});
