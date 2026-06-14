import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("craftEngineWasmFirstPluginTokens", () => {
  it("applyPluginLoremIpsumToSelection fills text content", () => {
    const id = `text-lorem-${Date.now()}`;
    useEditorStore.setState({
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "text",
          name: "Label",
          x: 0,
          y: 0,
          width: 120,
          height: 24,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          content: "Hi",
          textResizeMode: "auto-width",
          fillEnabled: true,
          fillOpacity: 1,
        },
      },
      childOrder: { [ROOT]: [id] },
      selectedIds: [id],
    });
    useEditorStore.getState().applyPluginLoremIpsumToSelection();
    const content = useEditorStore.getState().nodes[id]?.content ?? "";
    assert.ok(content.includes("Lorem ipsum"));
  });

  it("createSpacingToken adds spacing token", () => {
    useEditorStore.setState({ designTokens: {} });
    useEditorStore.getState().createSpacingToken("Gutter", 16);
    const tokens = Object.values(useEditorStore.getState().designTokens);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0]?.type, "spacing");
    assert.equal((tokens[0]?.value as { value?: number })?.value, 16);
  });

  it("updateDesignToken patches token name", () => {
    const tid = `color-${Date.now()}`;
    useEditorStore.setState({
      designTokens: {
        [tid]: {
          id: tid,
          name: "Old",
          type: "color",
          value: { hex: "#112233", opacity: 1 },
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    useEditorStore.getState().updateDesignToken(tid, { name: "Brand Blue" });
    assert.equal(useEditorStore.getState().designTokens[tid]?.name, "Brand Blue");
  });

  it("deleteDesignToken clears node token bindings", () => {
    const tid = `color-bind-${Date.now()}`;
    const id = `rect-bind-${Date.now()}`;
    useEditorStore.setState({
      designTokens: {
        [tid]: {
          id: tid,
          name: "Bind",
          type: "color",
          value: { hex: "#112233", opacity: 1 },
          createdAt: 1,
          updatedAt: 1,
        },
      },
      nodes: {
        [id]: {
          id,
          parentId: null,
          type: "rectangle",
          name: "Rect",
          x: 0,
          y: 0,
          width: 80,
          height: 60,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
          fillTokenId: tid,
        },
      },
      childOrder: { [ROOT]: [id] },
    });
    useEditorStore.getState().deleteDesignToken(tid);
    assert.equal(useEditorStore.getState().designTokens[tid], undefined);
    assert.equal(useEditorStore.getState().nodes[id]?.fillTokenId, undefined);
  });
});
