import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultFillGradient, removeStop } from "@/lib/gradient";
import {
  getActiveGradientStopTarget,
  setActiveGradientStopTarget,
  tryDeleteActiveGradientStop,
} from "@/lib/gradientStopKeyboard";
import { useEditorStore } from "@/stores/useEditorStore";

describe("gradientStopKeyboard", () => {
  it("removes the active gradient stop on Delete", () => {
    const g = defaultFillGradient("#111111", "linear");
    g.stops = [
      { id: "a", color: "#111111", opacity: 1, position: 0 },
      { id: "b", color: "#803225", opacity: 1, position: 47.8 },
      { id: "c", color: "#000000", opacity: 1, position: 100 },
    ];
    const nodeId = "rect-1";
    useEditorStore.setState({
      editorMode: "design",
      selectedIds: [nodeId],
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fillType: "gradient",
          fillGradient: g,
        },
      },
    } as Partial<ReturnType<typeof useEditorStore.getState>>);

    setActiveGradientStopTarget({ nodeId, stopId: "b" });
    const event = {
      code: "Delete",
      target: null,
      preventDefault() {},
    } as unknown as KeyboardEvent;

    const handled = tryDeleteActiveGradientStop(event, null);
    assert.equal(handled, true);

    const next = useEditorStore.getState().nodes[nodeId]?.fillGradient;
    assert.ok(next);
    assert.equal(next!.stops.length, 2);
    assert.equal(next!.stops.some((s) => s.id === "b"), false);
    assert.equal(getActiveGradientStopTarget()?.stopId, "a");
  });

  it("does not delete when only two stops remain", () => {
    const g = defaultFillGradient("#111111", "linear");
    const nodeId = "rect-2";
    useEditorStore.setState({
      editorMode: "design",
      selectedIds: [nodeId],
      nodes: {
        [nodeId]: {
          id: nodeId,
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fillType: "gradient",
          fillGradient: g,
        },
      },
    } as Partial<ReturnType<typeof useEditorStore.getState>>);

    setActiveGradientStopTarget({ nodeId, stopId: g.stops[0]!.id });
    const event = {
      code: "Delete",
      target: null,
      preventDefault() {},
    } as unknown as KeyboardEvent;

    assert.equal(tryDeleteActiveGradientStop(event, null), false);
    assert.equal(removeStop(g, g.stops[0]!.id), null);
  });
});
