import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  browserCaptureMatchesNodeContent,
  hasBrowserTextLayout,
} from "@/lib/craftBridge/browserCaptureTextLayout";
import { DEFAULT_TEXT_ADVANCED_STYLE } from "@/lib/text/textAdvancedStyle";
import { layoutTextCanonical } from "@/lib/text/canonicalTextLayout";
import type { EditorNode } from "@/stores/useEditorStore";

describe("browserCaptureTextLayout", () => {
  it("browserCaptureMatchesNodeContent compares prepared display text", () => {
    const capture = {
      content: "Hello",
      lines: [{ text: "Hello", x: 0, y: 0, width: 40, height: 16, startIndex: 0 }],
    };
    const node = {
      content: "Hello",
    } as EditorNode;
    assert.equal(browserCaptureMatchesNodeContent(node, capture, DEFAULT_TEXT_ADVANCED_STYLE), true);
    assert.equal(
      browserCaptureMatchesNodeContent({ ...node, content: "Hello world" }, capture, DEFAULT_TEXT_ADVANCED_STYLE),
      false,
    );
  });

  it("layoutTextCanonical ignores stale browser capture after content edits", () => {
    const node: EditorNode = {
      id: "web-1",
      parentId: null,
      type: "text",
      name: "Label",
      x: 0,
      y: 0,
      width: 120,
      height: 20,
      rotation: 0,
      visible: true,
      locked: false,
      content: "Updated label",
      fontSize: 16,
      fontFamily: "Inter",
      browserTextLayout: {
        content: "Original",
        lines: [
          {
            text: "Original",
            x: 0,
            y: 0,
            width: 60,
            height: 16,
            startIndex: 0,
          },
        ],
      },
    };
    assert.equal(hasBrowserTextLayout(node), true);
    assert.equal(
      browserCaptureMatchesNodeContent(node, node.browserTextLayout!, DEFAULT_TEXT_ADVANCED_STYLE),
      false,
    );
    const canonical = layoutTextCanonical(node, { bypassCache: true });
    assert.ok(canonical);
    assert.notEqual(canonical!.browserPaint, true);
  });
});
