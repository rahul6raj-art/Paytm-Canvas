import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  clampPanelWidth,
  clampPanelWidthInLayout,
  LEFT_SIDEBAR_BOUNDS,
  MIN_CANVAS_WORKSPACE_WIDTH,
  readLeftSidebarWidth,
  writeLeftSidebarWidth,
  writeRightPanelWidth,
  readRightPanelWidth,
} from "@/lib/sidebarPanelWidths";

describe("sidebarPanelWidths", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
        removeItem: (k: string) => {
          storage.delete(k);
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("clamps panel widths to bounds", () => {
    assert.equal(clampPanelWidth(100, LEFT_SIDEBAR_BOUNDS), 240);
    assert.equal(clampPanelWidth(999, LEFT_SIDEBAR_BOUNDS), 520);
    assert.equal(clampPanelWidth(220.4, LEFT_SIDEBAR_BOUNDS), 240);
  });

  it("caps panel max against viewport and reserved chrome", () => {
    const layout = {
      getViewportWidth: () => 1000,
      getReservedChromeWidth: () => 300,
    };
    const cap = 1000 - 300 - MIN_CANVAS_WORKSPACE_WIDTH;
    assert.equal(clampPanelWidthInLayout(500, LEFT_SIDEBAR_BOUNDS, layout), cap);
    assert.equal(clampPanelWidthInLayout(200, LEFT_SIDEBAR_BOUNDS, layout), 240);
  });

  it("persists left and right panel widths separately", () => {
    writeLeftSidebarWidth(300);
    writeRightPanelWidth(320, false);
    writeRightPanelWidth(400, true);
    assert.equal(readLeftSidebarWidth(), 300);
    assert.equal(readRightPanelWidth(false), 320);
    assert.equal(readRightPanelWidth(true), 400);
  });
});
