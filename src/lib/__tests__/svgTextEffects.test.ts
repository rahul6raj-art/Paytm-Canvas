import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createSvgFilterRegistry, wrapSvgNodeFilter } from "@/lib/svgMarkupCore";

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
