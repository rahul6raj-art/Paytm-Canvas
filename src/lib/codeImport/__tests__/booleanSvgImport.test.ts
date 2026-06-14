import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseHtmlImportTree } from "@/lib/codeImport/htmlParseTree";
import {
  parseBooleanOperandsFromExportSvg,
  parseBooleanOperandsFromMarkup,
} from "@/lib/codeImport/booleanSvgImport";

describe("booleanSvgImport", () => {
  it("parses exclude operands from exported boolean SVG", () => {
    const html = `<html><body><div data-pc-boolean-op="exclude"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><mask id="m0"><path d="M 10 10 L 90 10 L 90 90 Z" fill="white"/><path d="M 30 30 L 70 30 L 70 70 Z" fill="black"/></mask></defs>
<path d="M 10 10 L 90 10 L 90 90 Z" fill="#e5e5e5" mask="url(#m0)"/>
<path d="M 30 30 L 70 30 L 70 70 Z" fill="#e5e5e5" mask="url(#m1)"/>
</svg></div></body></html>`;
    const parsed = parseHtmlImportTree(html);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const div = parsed.root.childElements()[0]!;
    const svg = div.childElements().find((c) => c.tagLower === "svg");
    assert.ok(svg);
    const ops = parseBooleanOperandsFromExportSvg(svg!, "exclude");
    assert.ok(ops);
    assert.equal(ops!.operandDs.length, 2);
    assert.equal(ops!.fill, "#e5e5e5");
  });

  it("parses Clipper2 composite path contours as operands", () => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">
<path d="M 180 150 L 20 150 L 20 10 L 180 10 Z M 60 40 L 60 120 L 140 120 L 140 40 Z" fill-rule="evenodd" fill="#e5e5e5"/>
</svg>`;
    const ops = parseBooleanOperandsFromMarkup(markup, "exclude");
    assert.ok(ops);
    assert.equal(ops!.operandDs.length, 2);
    assert.equal(ops!.fill, "#e5e5e5");
  });

  it("parses exclude operands from inner markup when SVG tree is unavailable", () => {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><mask id="m0"><path d="M 10 10 L 90 10 L 90 90 Z" fill="white"/><path d="M 30 30 L 70 30 L 70 70 Z" fill="black"/></mask></defs>
<path d="M 10 10 L 90 10 L 90 90 Z" fill="#cfcfcf" mask="url(#m0)"/>
<path d="M 30 30 L 70 30 L 70 70 Z" fill="#cfcfcf" mask="url(#m1)"/>
</svg>`;
    const ops = parseBooleanOperandsFromMarkup(markup, "exclude");
    assert.ok(ops);
    assert.equal(ops!.operandDs.length, 2);
    assert.equal(ops!.fill, "#cfcfcf");
  });

});
