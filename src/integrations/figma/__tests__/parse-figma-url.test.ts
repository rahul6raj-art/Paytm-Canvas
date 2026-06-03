import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isFigmaDesignUrl,
  parseFigmaFileKey,
  parseFigmaUrl,
} from "@/integrations/figma/parse-figma-url";

describe("parseFigmaUrl", () => {
  it("parses design URLs with node-id and trims whitespace", () => {
    const r = parseFigmaUrl(
      "  https://www.figma.com/design/jqUgqeCZxSTxaBh1knsk3L/Test?node-id=36-2738&t=x  ",
    );
    assert.equal(r!.fileKey, "jqUgqeCZxSTxaBh1knsk3L");
    assert.equal(r!.nodeId, "36:2738");
  });

  it("parses design URLs with node-id", () => {
    const r = parseFigmaUrl(
      "https://www.figma.com/design/AbCdEf/My-File?node-id=1-234",
    );
    assert.ok(r);
    assert.equal(r!.fileKey, "AbCdEf");
    assert.equal(r!.nodeId, "1:234");
  });

  it("parses legacy file URLs", () => {
    const r = parseFigmaUrl("https://www.figma.com/file/xyz123/Name");
    assert.ok(r);
    assert.equal(r!.fileKey, "xyz123");
  });
});

describe("parseFigmaFileKey", () => {
  it("accepts alphanumeric file keys", () => {
    assert.equal(parseFigmaFileKey("AbCdEf12"), "AbCdEf12");
  });

  it("rejects invalid keys", () => {
    assert.equal(parseFigmaFileKey("not a key!"), null);
  });
});

describe("isFigmaDesignUrl", () => {
  it("returns true for figma design links", () => {
    assert.equal(isFigmaDesignUrl("https://www.figma.com/design/abc/Title"), true);
  });
});
