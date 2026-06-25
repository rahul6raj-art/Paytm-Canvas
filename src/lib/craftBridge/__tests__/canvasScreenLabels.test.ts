import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCanvasScreenLabelToRoots,
  canvasScreenLabelFromPageTitle,
  canvasScreenLabelFromSource,
  stripBrowserPageTitle,
} from "../canvasScreenLabels";

describe("canvasScreenLabels", () => {
  it("maps PML page files to PML- Screen labels", () => {
    assert.equal(
      canvasScreenLabelFromSource("src/screens/PMLMorePage/PMLMorePage.tsx"),
      "PML- More",
    );
    assert.equal(canvasScreenLabelFromSource("PMLHomePage.tsx"), "PML- Home");
    assert.equal(canvasScreenLabelFromSource("PMLSignupPage"), "PML- Signup");
  });

  it("strips dev-server suffixes from browser titles", () => {
    assert.equal(stripBrowserPageTitle("PML More (npm run dev)"), "PML More");
    assert.equal(stripBrowserPageTitle("PML Home | Vite"), "PML Home");
  });

  it("maps captured tab titles to canvas labels", () => {
    assert.equal(canvasScreenLabelFromPageTitle("PML More (npm run dev)"), "PML- More");
    assert.equal(canvasScreenLabelFromPageTitle("PML Home | Vite"), "PML- Home");
  });

  it("renames root artboard nodes", () => {
    const nodes = applyCanvasScreenLabelToRoots(
      {
        root: {
          id: "root",
          parentId: null,
          type: "frame",
          name: "PML More (npm run dev)",
          x: 0,
          y: 0,
          width: 390,
          height: 844,
          rotation: 0,
          visible: true,
          locked: false,
          expanded: true,
        },
      },
      ["root"],
      "PML- More",
    );
    assert.equal(nodes.root?.name, "PML- More");
  });
});
