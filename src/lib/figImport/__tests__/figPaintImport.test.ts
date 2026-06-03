import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FigNode, FigPaint } from "openfig-core";
import { normalizePaintType } from "@/lib/figImport/figPaintCore";
import {
  effectiveNodeFillPaints,
  resolvePaintList,
  solidFillFromPaints,
} from "@/lib/figImport/figImportProperties";
import { __figImportTest } from "@/lib/figImport/figToPaytmCraft";

const {
  applySymbolOverrides,
  figDisplayName,
  figLineHeightMultiplier,
  figLetterSpacingPx,
  dominantTextFillFromRuns,
} = __figImportTest;

describe("fig paint and typography import helpers", () => {
  it("normalizes numeric Kiwi paint types to SOLID", () => {
    assert.equal(normalizePaintType(0), "SOLID");
    assert.equal(normalizePaintType(1), "GRADIENT_LINEAR");
    assert.equal(normalizePaintType("solid"), "SOLID");
  });

  it("reads solid fill from numeric paint type", () => {
    const paints = [
      { type: 0, color: { r: 1, g: 0, b: 0, a: 1 }, visible: true },
    ] as unknown as FigPaint[];
    const resolved = resolvePaintList(paints, new Map());
    const solid = solidFillFromPaints(resolved);
    assert.equal(solid.fill, "#ff0000");
  });

  it("resolves fill from styleOverrideTable when fillPaints is empty", () => {
    const node = {
      guid: { sessionID: 1, localID: 2 },
      type: "RECTANGLE",
      name: "Box",
      fillGeometry: [{ styleID: 2 }],
      vectorData: {
        styleOverrideTable: [
          {
            styleID: 2,
            fillPaints: [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1, a: 1 }, visible: true }],
          },
        ],
      },
    } as FigNode;

    const paints = effectiveNodeFillPaints(node);
    const solid = solidFillFromPaints(resolvePaintList(paints, new Map()));
    assert.equal(solid.fill, "#0080ff");
  });

  it("applies instance symbol overrides to child fills and names", () => {
    const symbolChild = {
      guid: { sessionID: 2, localID: 10 },
      type: "TEXT",
      name: "Label",
      fillPaints: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 }, visible: true }],
    } as FigNode;

    const instance = {
      guid: { sessionID: 1, localID: 1 },
      type: "INSTANCE",
      symbolData: {
        symbolOverrides: [
          {
            guidPath: { guids: [{ sessionID: 2, localID: 10 }] },
            name: "Custom label",
            fillPaints: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 }, visible: true }],
          },
        ],
      },
    } as FigNode;

    const merged = applySymbolOverrides(symbolChild, instance);
    assert.equal(figDisplayName(merged), "Custom label");
    const solid = solidFillFromPaints(resolvePaintList(merged.fillPaints, new Map()));
    assert.equal(solid.fill, "#ff0000");
  });

  it("uses per-run fill from characterStyleIDs", () => {
    const node = {
      guid: { sessionID: 1, localID: 3 },
      type: "TEXT",
      name: "Rich",
      textData: {
        characters: "ab",
        characterStyleIDs: [0, 1],
        styleOverrideTable: [
          {
            styleID: 1,
            fillPaints: [{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 1 }, visible: true }],
          },
        ],
      },
    } as FigNode;

    const runFill = dominantTextFillFromRuns(node, new Map());
    assert.equal(runFill.fill, "#00ff00");
  });

  it("parses line height and letter spacing from fig fields", () => {
    const node = {
      fontSize: 20,
      lineHeight: { value: 1.4, units: "RAW" },
      letterSpacing: { value: -5, units: "PERCENT" },
    } as FigNode;
    assert.equal(figLineHeightMultiplier(node), 1.4);
    assert.equal(figLetterSpacingPx(node), -1);
  });

  it("figDisplayName falls back when name is blank", () => {
    const node = { type: "FRAME", name: "   ", guid: { sessionID: 1, localID: 9 } } as FigNode;
    assert.equal(figDisplayName(node), "Frame");
  });
});
