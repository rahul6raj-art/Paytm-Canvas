import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildComponentMasterThumbnail } from "@/lib/components/componentMasterThumbnail";
import type { EditorNode } from "@/stores/useEditorStore";

describe("buildComponentMasterThumbnail", () => {
  it("renders a button-like master subtree as SVG markup", () => {
    const nodes: Record<string, EditorNode> = {
      master: {
        id: "master",
        parentId: "lib",
        type: "frame",
        name: "Components/Button",
        x: 0,
        y: 120,
        width: 120,
        height: 48,
        rotation: 0,
        visible: true,
        locked: false,
        fillEnabled: true,
        fill: "#0d44bf",
        cornerRadius: 8,
      },
      label: {
        id: "label",
        parentId: "master",
        type: "text",
        name: "Label",
        x: 24,
        y: 14,
        width: 72,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Continue",
        fontSize: 16,
        fontWeight: 600,
        textColor: "#ffffff",
        fill: "#ffffff",
        fillEnabled: true,
      },
    };
    const childOrder = {
      master: ["label"],
    };

    const thumb = buildComponentMasterThumbnail("master", nodes, childOrder);
    assert.ok(thumb);
    assert.match(thumb!.svg, /<svg/);
    assert.match(thumb!.svg, /Continue/);
    assert.equal(thumb!.width, 120);
    assert.equal(thumb!.height, 48);
  });
});
