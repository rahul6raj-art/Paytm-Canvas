import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createSvgFilterRegistry, wrapSvgNodeFilter } from "@/lib/svgMarkupCore";
import { buildSvgScene } from "@/lib/svgSceneMarkup";
import type { EditorNode } from "@/stores/useEditorStore";

describe("svgTextEffects", () => {
  it("wrapSvgNodeFilter applies filter attribute to markup", () => {
    const wrapped = wrapSvgNodeFilter('<text fill="#111"><tspan>Hello</tspan></text>', "pc-filter-t1");
    assert.match(wrapped, /^<g filter="url\(#pc-filter-t1\)">/);
    assert.match(wrapped, /<tspan>Hello<\/tspan>/);
  });

  it("createSvgFilterRegistry builds drop-shadow and inner-shadow defs", () => {
    const registry = createSvgFilterRegistry();
    const dropRef = registry.register("t1", [
      {
        id: "fx1",
        type: "drop-shadow",
        visible: true,
        x: 0,
        y: 4,
        blur: 8,
        color: "#000000",
        opacity: 0.25,
      },
    ]);
    assert.equal(dropRef, "pc-filter-t1");
    assert.match(registry.defs.join(""), /feDropShadow/);

    const innerRef = registry.register("t2", [
      {
        id: "fx2",
        type: "inner-shadow",
        visible: true,
        x: 1,
        y: 2,
        blur: 4,
        color: "#000000",
        opacity: 0.3,
      },
    ]);
    assert.equal(innerRef, "pc-filter-t2");
    assert.match(registry.defs.join(""), /pc-inner-shadow-t2/);
  });

  it("buildSvgScene applies group effects to child-only outlined text groups", () => {
    const groupId = "g1";
    const pathId = "p1";
    const nodes: Record<string, EditorNode> = {
      [groupId]: {
        id: groupId,
        parentId: null,
        type: "group",
        name: "Rahu",
        x: 0,
        y: 0,
        width: 45,
        height: 18,
        rotation: 0,
        visible: true,
        locked: false,
        fillEnabled: false,
        effects: [
          {
            id: "fx1",
            type: "drop-shadow",
            visible: true,
            x: 0,
            y: 4,
            blur: 8,
            color: "#ff0000",
            opacity: 0.5,
          },
        ],
      } as EditorNode,
      [pathId]: {
        id: pathId,
        parentId: groupId,
        type: "path",
        name: "Vector",
        x: 2,
        y: 2,
        width: 10,
        height: 10,
        rotation: 0,
        visible: true,
        locked: false,
        fill: "#ffffff",
        fillEnabled: true,
        pathPoints: [
          { id: "a", x: 0, y: 0 },
          { id: "b", x: 10, y: 0 },
          { id: "c", x: 10, y: 10 },
        ],
        pathClosed: true,
      } as EditorNode,
    };
    const scene = buildSvgScene({
      rootIds: [groupId],
      nodes,
      childOrder: { [groupId]: [pathId] },
    });
    assert.match(scene.body, /filter="url\(#pc-filter-g1\)"/);
    assert.match(scene.defs, /feDropShadow/);
  });

  it("svgSceneMarkup wraps text effects outside clip-path", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/svgSceneMarkup.ts"),
      "utf8",
    );
    assert.match(src, /wrapSvgNodeFilter\(wrapped, filterRef\)/);
    assert.doesNotMatch(
      src,
      /clip-path="url\(#\$\{clipId\}\)"\}\">\$\{markup\}<\/g>`;\s*\n\s*return wrapOpacity/,
    );
  });
});
