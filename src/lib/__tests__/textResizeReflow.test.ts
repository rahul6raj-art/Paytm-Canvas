import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";

function installTextMeasureDomStub(): void {
  const ctx = {
    font: "",
    measureText(text: string) {
      return { width: text.length * 7 };
    },
    fillText() {},
  };

  globalThis.document = {
    createElement(tag: string) {
      if (tag !== "canvas") return {} as HTMLElement;
      return {
        getContext() {
          return ctx;
        },
      } as HTMLCanvasElement;
    },
  } as Document;
}

describe("text resize reflow", () => {
  before(() => {
    installTextMeasureDomStub();
  });

  it("wraps when east handle narrows auto-width text during live resize", () => {
    const id = "text-resize-live";
    const start = { x: 0, y: 0, width: 200, height: 24 };
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "text",
          name: "T",
          x: 0,
          y: 0,
          width: 200,
          height: 24,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          content: "Hello World from Figma",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.25,
          textResizeMode: "auto-width",
          autoResize: "width-height",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
      transformInteractionMode: "none",
    });

    useEditorStore.getState().setTransformInteractionMode("resize");
    useEditorStore.getState().resizeNode(
      id,
      "e",
      start,
      { x: 80, y: 12 },
      { shiftKey: false, altKey: false, lockAspectRatio: false },
      { skipHistory: true },
    );

    const node = useEditorStore.getState().nodes[id]!;
    const layout = textLayoutForEditorNode(node);
    assert.equal(node.textResizeMode, "auto-height");
    assert.equal(node.autoResize, "height");
    assert.ok(node.width < start.width);
    assert.ok((layout?.layout.lines.length ?? 0) > 1, "expected wrapped lines after narrow resize");
    assert.ok((node.height ?? 0) > start.height, "expected taller box after wrap");
  });

  it("converts auto-height to fixed on south handle shrink without reflow width", () => {
    const id = "text-resize-height";
    const start = { x: 0, y: 0, width: 120, height: 48 };
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "text",
          name: "T",
          x: 0,
          y: 0,
          width: 120,
          height: 48,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          content: "Hello World from Figma",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.25,
          textResizeMode: "auto-height",
          autoResize: "height",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
      transformInteractionMode: "none",
    });

    useEditorStore.getState().setTransformInteractionMode("resize");
    useEditorStore.getState().resizeNode(
      id,
      "s",
      start,
      { x: 60, y: 30 },
      { shiftKey: false, altKey: false, lockAspectRatio: false },
      { skipHistory: true },
    );

    const node = useEditorStore.getState().nodes[id]!;
    assert.equal(node.textResizeMode, "fixed");
    assert.equal(node.width, start.width);
    assert.ok(node.height < start.height);
  });

  it("wraps auto-height text when east handle narrows width", () => {
    const id = "text-resize-auto-height";
    const start = { x: 0, y: 0, width: 120, height: 48 };
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "text",
          name: "T",
          x: 0,
          y: 0,
          width: 120,
          height: 48,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          content: "Hello World from Figma",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.25,
          textResizeMode: "auto-height",
          autoResize: "height",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
      transformInteractionMode: "none",
    });

    useEditorStore.getState().setTransformInteractionMode("resize");
    useEditorStore.getState().resizeNode(
      id,
      "e",
      start,
      { x: 50, y: 24 },
      { shiftKey: false, altKey: false, lockAspectRatio: false },
      { skipHistory: true },
    );

    const node = useEditorStore.getState().nodes[id]!;
    const layout = textLayoutForEditorNode(node);
    assert.equal(node.textResizeMode, "auto-height");
    assert.ok(node.width < start.width);
    assert.ok((layout?.layout.lines.length ?? 0) > 1);
    assert.ok((node.height ?? 0) > start.height);
  });

  it("wraps when aspect lock narrows width on east handle", () => {
    const id = "text-resize-aspect";
    const start = { x: 0, y: 0, width: 200, height: 40 };
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "text",
          name: "T",
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          content: "Hello World from Figma",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.25,
          textResizeMode: "auto-width",
          autoResize: "width-height",
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
      transformInteractionMode: "none",
      inspectorAspectRatioLocked: true,
    });

    useEditorStore.getState().setTransformInteractionMode("resize");
    useEditorStore.getState().resizeNode(
      id,
      "e",
      start,
      { x: 80, y: 20 },
      { shiftKey: false, altKey: false, lockAspectRatio: true },
      { skipHistory: true },
    );

    const node = useEditorStore.getState().nodes[id]!;
    const layout = textLayoutForEditorNode(node);
    assert.equal(node.textResizeMode, "auto-height");
    assert.ok((layout?.layout.lines.length ?? 0) > 1);
  });
});
