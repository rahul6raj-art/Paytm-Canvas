import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeHex, parseHexInputLive } from "@/lib/color";

describe("color", () => {
  it("parseHexInputLive applies only full 6-digit hex", () => {
    assert.equal(parseHexInputLive("cc"), null);
    assert.equal(parseHexInputLive("#ccccf"), null);
    assert.equal(parseHexInputLive("#fff"), null);
    assert.equal(parseHexInputLive("cfcfcf"), "#cfcfcf");
    assert.equal(parseHexInputLive("#cfcfcf"), "#cfcfcf");
  });

  it("normalizeHex accepts shorthand", () => {
    assert.equal(normalizeHex("#fff"), "#ffffff");
    assert.equal(normalizeHex("ccccff"), "#ccccff");
  });
});
