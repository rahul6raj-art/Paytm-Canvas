import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import { applyMatrixToPathD } from "@/lib/mask/buildExactMaskPath";
import { layerPanelDisplayChildIds } from "@/lib/editorGraph";
import { translateMatrix } from "@/lib/transformMath";
import { convertTextToOutlineVectorGroup } from "@/lib/text/textOutlineToVectors";
import { TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y } from "@/lib/text/textNodeModel";
import type { EditorNode } from "@/stores/useEditorStore";

const interRegular = path.join(
  process.cwd(),
  "packages/craft-engine/assets/Inter-Regular.ttf",
);
const interBold = path.join(
  process.cwd(),
  "packages/craft-engine/assets/Inter-Bold.ttf",
);

function createOutlineMeasureContext(font: opentype.Font) {
  let textBaseline = "alphabetic";
  return {
    font: "",
    get textBaseline() {
      return textBaseline;
    },
    set textBaseline(value: string) {
      textBaseline = value;
    },
    measureText(text: string) {
      const ch = text[0] ?? " ";
      let width = 0;
      for (let i = 0; i < text.length; i++) {
        width += font.getAdvanceWidth(text[i]!, 14);
      }
      const bb = font.charToGlyph(ch).getPath(0, 0, 14).getBoundingBox();
      const ascent = Math.max(0.001, -bb.y1);
      const descent = Math.max(0.001, bb.y2);
      return {
        width,
        fontBoundingBoxAscent: ascent,
        fontBoundingBoxDescent: descent,
        actualBoundingBoxAscent: ascent,
        actualBoundingBoxDescent: descent,
        actualBoundingBoxLeft: bb.x1,
        actualBoundingBoxRight: bb.x2,
      };
    },
    fillText() {},
  };
}

function mockOutlineDocument(fontFile: string) {
  const buffer = fs.readFileSync(fontFile);
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  globalThis.document = {
    createElement: () => ({ getContext: () => createOutlineMeasureContext(font) }),
  };
  globalThis.fetch = async (url: string) => {
    const file = decodeURIComponent(String(url).split("/").pop());
    const fileBuffer = fs.readFileSync(path.join(process.cwd(), "packages/craft-engine/assets", file));
    return {
      ok: true,
      arrayBuffer: async () =>
        fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
    };
  };
  return font;
}

describe("textOutlineToVectors", () => {
  it("preserves compound glyph contours for R with evenodd-friendly path data", () => {
    const buffer = fs.readFileSync(interRegular);
    const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const otPath = font.getPath("R", 0, 0, 72);
    const pathD = otPath.toPathData(2);
    const bbox = otPath.getBoundingBox();
    const localPathD = applyMatrixToPathD(pathD, translateMatrix(-bbox.x1, -bbox.y1));
    assert.ok(localPathD);
    const moveCount = (localPathD!.match(/M/gi) ?? []).length;
    assert.ok(moveCount >= 2, "R should have outer contour and inner counter");
  });

  it("layer panel shows outlined letters in reading order top-to-bottom", () => {
    const groupId = "g1";
    const ids = ["r", "a", "h", "u", "l"];
    const nodes: Record<string, EditorNode> = {
      [groupId]: {
        id: groupId,
        parentId: null,
        type: "group",
        name: "Rahul",
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
      } as EditorNode,
      ...Object.fromEntries(
        ids.map(
          (id) =>
            [
              id,
              {
                id,
                parentId: groupId,
                type: "path",
                name: "Vector",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                rotation: 0,
                visible: true,
                locked: false,
              },
            ] as const,
        ),
      ),
    };
    const childOrder = { [groupId]: [...ids].reverse() };
    const display = layerPanelDisplayChildIds(groupId, nodes, childOrder);
    assert.deepEqual(display, ["r", "a", "h", "u", "l"]);
  });

  it("converts Rahul text into five vector paths", async () => {
    mockOutlineDocument(interRegular);

    const node = {
      id: "t1",
      type: "text",
      name: "Rahul",
      x: 0,
      y: 0,
      width: 45,
      height: 18,
      parentId: null,
      visible: true,
      locked: false,
      content: "Rahul",
      fontSize: 14,
      fontFamily: "Inter",
      fontWeight: 500,
      lineHeight: 1.25,
      textResizeMode: "auto-width",
      fillEnabled: true,
      fill: "#fff",
    } as EditorNode;

    const result = await convertTextToOutlineVectorGroup(node, {}, (p) => `${p}-1`);
    assert.ok(result);
    assert.equal(result!.group.type, "group");
    assert.equal(result!.vectors.length, 5);
    for (const vector of result!.vectors) {
      assert.ok(vector.width > 0);
      assert.ok(vector.height > 0);
    }
  });

  it("preserves canvas letter spacing when outlining", async () => {
    mockOutlineDocument(interRegular);

    const node = {
      id: "t1",
      type: "text",
      name: "Rahul",
      x: 0,
      y: 0,
      width: 45,
      height: 18,
      parentId: null,
      visible: true,
      locked: false,
      content: "Rahul",
      fontSize: 14,
      fontFamily: "Inter",
      fontWeight: 500,
      lineHeight: 1.25,
      textResizeMode: "auto-width",
      fillEnabled: true,
      fill: "#fff",
    } as EditorNode;

    const result = await convertTextToOutlineVectorGroup(node, {}, (p) => `${p}-1`);
    assert.ok(result);
    const sorted = [...result!.vectors].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      assert.ok(cur.x >= prev.x, "outlined glyphs should not shift left");
    }
    assert.equal(result!.group.width, 45);
    assert.equal(result!.group.height, 18);
    assert.ok(Math.abs(sorted[0]!.x - TEXT_BOX_PAD_X) < 1.5, "first glyph keeps text inset");
  });

  it("preserves text layer effects on the outlined group", async () => {
    mockOutlineDocument(interRegular);

    const node = {
      id: "t1",
      type: "text",
      name: "Rahu",
      x: 0,
      y: 0,
      width: 45,
      height: 18,
      parentId: null,
      visible: true,
      locked: false,
      content: "Rahu",
      fontSize: 14,
      fontFamily: "Inter",
      fontWeight: 500,
      lineHeight: 1.25,
      textResizeMode: "auto-width",
      fillEnabled: true,
      fill: "#fff",
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
    } as EditorNode;

    const result = await convertTextToOutlineVectorGroup(node, {}, (p) => `${p}-1`);
    assert.ok(result);
    assert.equal(result!.group.effects?.length, 1);
    assert.equal(result!.group.effects?.[0]?.type, "drop-shadow");
  });
});
