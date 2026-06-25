import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import { layerPanelChildIds } from "@/lib/editorGraph";
import { ROOT, useEditorStore } from "@/stores/useEditorStore";

describe("arrow tool flow", () => {
  it("creates an arrow node from drag and renders line markup in SVG scene", () => {
    useEditorStore.setState({ editorMode: "design", shapeDrawingSession: null, tool: "arrow" });
    const store = useEditorStore.getState();
    store.startShapeFromDrag("arrow", { x: 100, y: 100 }, { shiftKey: false, altKey: false });
    const session = useEditorStore.getState().shapeDrawingSession;
    assert.ok(session);
    store.updateShapeFromDrag({ x: 300, y: 150 }, { shiftKey: false, altKey: false });
    store.finishShapeFromDrag({ x: 300, y: 150 }, { shiftKey: false, altKey: false });

    const st = useEditorStore.getState();
    assert.equal(st.shapeDrawingSession, null);
    const arrow = Object.values(st.nodes).find((n) => n.type === "arrow");
    assert.ok(arrow);
    assert.ok(arrow.width > 10);
    assert.equal(arrow.endArrow, "line");
    assert.equal(arrow.strokeEndPoint, "line-arrow");

    const scene = buildSvgScene({
      rootIds: layerPanelChildIds(ROOT, st.nodes, st.childOrder),
      nodes: st.nodes,
      childOrder: st.childOrder,
      selectedIds: st.selectedIds,
    });
    assert.match(scene.body, /<line\b/);
    assert.match(
      scene.body + scene.defs,
      /line-arrow|stroke-linecap="round"/,
      "arrow scene markup should include a stroke chevron marker",
    );
  });
});
