import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFigmaUrl } from "../parseFigmaUrl";

describe("parseFigmaUrl", () => {
  it("parses design URL with node id", () => {
    const r = parseFigmaUrl(
      "https://www.figma.com/design/AbCdEf/My-File?node-id=1-234",
    );
    assert.ok(r);
    assert.equal(r!.fileKey, "AbCdEf");
    assert.equal(r!.nodeId, "1:234");
  });

  it("parses file URL", () => {
    const r = parseFigmaUrl("https://www.figma.com/file/xyz123/Name");
    assert.ok(r);
    assert.equal(r!.fileKey, "xyz123");
    assert.equal(r!.nodeId, undefined);
  });
});
