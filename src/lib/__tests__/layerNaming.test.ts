import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  duplicatedTextLayerName,
  layerNameFromTextContent,
  maxNumberedLayerIndex,
  nextDuplicatedLayerName,
  nextNumberedLayerName,
  parseNumberedLayerName,
} from "@/lib/layerNaming";

describe("layerNaming", () => {
  it("parses numbered and bare layer names", () => {
    assert.deepEqual(parseNumberedLayerName("Rectangle 3"), {
      base: "Rectangle",
      number: 3,
    });
    assert.deepEqual(parseNumberedLayerName("Rectangle"), {
      base: "Rectangle",
      number: 0,
    });
  });

  it("assigns incrementing names for new shapes", () => {
    const nodes = {
      a: { name: "Rectangle 1" },
      b: { name: "Rectangle" },
    };
    assert.equal(nextNumberedLayerName(nodes, "Rectangle"), "Rectangle 2");
    assert.equal(nextNumberedLayerName(nodes, "Ellipse"), "Ellipse 1");
  });

  it("duplicates with the next number instead of copy suffix", () => {
    const nodes = {
      a: { name: "Rectangle 1" },
      b: { name: "Rectangle 2" },
    };
    assert.equal(nextDuplicatedLayerName(nodes, "Rectangle 1"), "Rectangle 3");
    assert.equal(maxNumberedLayerIndex(nodes, "Rectangle"), 2);
  });

  it("uses canvas text for layer names", () => {
    assert.equal(layerNameFromTextContent(""), "Text");
    assert.equal(layerNameFromTextContent("  Hello\nWorld  "), "Hello");
    assert.equal(duplicatedTextLayerName("Checkout"), "Checkout");
  });
});
