import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldTrackSpaceForCanvasPan,
  syncCanvasPointerModifiers,
} from "@/lib/editorKeyboardFocus";

describe("canvas pan modifiers", () => {
  it("ignores Space keydown while typing in inspector fields", () => {
    assert.equal(
      shouldTrackSpaceForCanvasPan({
        code: "Space",
        target: { tagName: "INPUT" } as EventTarget,
      }),
      false,
    );
    assert.equal(
      shouldTrackSpaceForCanvasPan({
        code: "Space",
        target: { tagName: "DIV" } as EventTarget,
      }),
      true,
    );
  });

  it("syncs Space from pointer modifier state to clear stuck pan mode", () => {
    let spaceDown = true;
    syncCanvasPointerModifiers(
      { getModifierState: () => false },
      {
        setSpaceDown: (v) => {
          spaceDown = v;
        },
        setOptionDown: () => {},
        setCommandDown: () => {},
      },
    );
    assert.equal(spaceDown, false);
  });
});
