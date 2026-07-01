import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasPmlButtonClassToken,
  hasPmlStrokeButtonClassToken,
  isPmlIconButtonClassName,
} from "@/lib/webImport/pmlButtonClass";

describe("pmlButtonClass", () => {
  it("matches PML Button tokens without false positives on icon-btn", () => {
    assert.equal(hasPmlButtonClassToken("btn btn--stroke btn--large"), true);
    assert.equal(hasPmlButtonClassToken("header__icon-btn header__back-btn"), false);
    assert.equal(hasPmlStrokeButtonClassToken("btn btn--stroke btn--large"), true);
    assert.equal(hasPmlStrokeButtonClassToken("btn btn--filled btn--large"), false);
    assert.equal(isPmlIconButtonClassName("header__icon-btn header__back-btn"), true);
  });
});
