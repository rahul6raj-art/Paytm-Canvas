import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeLayout } from "../layoutAnalyzer";
import { buildDesignTree } from "../designNodeBuilder";
import { runDesignNativeImport } from "../pipeline";
import type { DomSnapshotNode } from "../types";

function node(partial: Partial<DomSnapshotNode> & Pick<DomSnapshotNode, "id" | "tagName" | "rect">): DomSnapshotNode {
  return {
    styles: {},
    children: [],
    ...partial,
  };
}

describe("layoutAnalyzer", () => {
  it("maps flex display to auto layout fields", () => {
    const flex = node({
      id: "flex",
      tagName: "div",
      rect: { x: 0, y: 0, width: 400, height: 200 },
      styles: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        paddingTop: "12px",
        paddingRight: "24px",
        paddingBottom: "12px",
        paddingLeft: "24px",
        justifyContent: "center",
        alignItems: "stretch",
        flexWrap: "wrap",
      },
      children: [
        node({ id: "a", tagName: "div", rect: { x: 24, y: 12, width: 100, height: 40 } }),
        node({ id: "b", tagName: "div", rect: { x: 24, y: 68, width: 100, height: 40 } }),
      ],
    });
    const layout = analyzeLayout(flex);
    assert.equal(layout.kind, "flex");
    assert.equal(layout.layoutMode, "vertical");
    assert.equal(layout.layoutGap, 16);
    assert.equal(layout.paddingTop, 12);
    assert.equal(layout.paddingRight, 24);
    assert.equal(layout.layoutWrap, true);
    assert.equal(layout.primaryAxisAlign, "center");
    assert.equal(layout.counterAxisAlign, "stretch");
  });

  it("infers fill sizing from flex-grow", () => {
    const child = node({
      id: "child",
      tagName: "div",
      rect: { x: 0, y: 0, width: 200, height: 40 },
      styles: { flexGrow: "1", width: "auto" },
    });
    const parent = node({
      id: "parent",
      tagName: "div",
      rect: { x: 0, y: 0, width: 400, height: 100 },
      styles: { display: "flex", flexDirection: "row" },
      children: [child],
    });
    const layout = analyzeLayout(child, parent);
    assert.equal(layout.layoutSizingHorizontal, "fill");
  });

  it("detects grid containers", () => {
    const grid = node({
      id: "grid",
      tagName: "div",
      rect: { x: 0, y: 0, width: 600, height: 300 },
      styles: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "20px",
      },
    });
    const layout = analyzeLayout(grid);
    assert.equal(layout.kind, "grid");
    assert.equal(layout.gridGap, 20);
    assert.equal(layout.layoutMode, "horizontal");
  });

  it("infers gap from Tailwind space-y class when computed gap is absent", () => {
    const flex = node({
      id: "flex",
      tagName: "div",
      className: "flex flex-col space-y-4",
      rect: { x: 0, y: 0, width: 400, height: 200 },
      styles: { display: "block" },
      children: [
        node({ id: "a", tagName: "div", rect: { x: 0, y: 0, width: 100, height: 40 } }),
        node({ id: "b", tagName: "div", rect: { x: 0, y: 56, width: 100, height: 40 } }),
      ],
    });
    const layout = analyzeLayout(flex);
    assert.equal(layout.kind, "flex");
    assert.equal(layout.layoutMode, "vertical");
    assert.equal(layout.layoutGap, 16);
  });
});

describe("design-native pipeline", () => {
  it("produces auto-layout frames from flex DOM", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 400, height: 300 },
      children: [
        node({
          id: "flex",
          tagName: "div",
          className: "toolbar",
          rect: { x: 0, y: 0, width: 400, height: 80 },
          styles: {
            display: "flex",
            flexDirection: "row",
            gap: "8px",
            paddingLeft: "16px",
            paddingRight: "16px",
            alignItems: "center",
          },
          children: [
            node({
              id: "btn",
              tagName: "button",
              text: "Save",
              rect: { x: 16, y: 20, width: 80, height: 40 },
              styles: {
                display: "flex",
                backgroundColor: "rgb(37, 99, 235)",
                color: "rgb(255, 255, 255)",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "8px",
              },
            }),
          ],
        }),
      ],
    });

    const design = buildDesignTree(root);
    const flexDesign = design.children[0];
    assert.equal(flexDesign?.layout.kind, "flex");
    assert.equal(flexDesign?.layout.layoutMode, "horizontal");

    const { scene, fidelity } = runDesignNativeImport(root, {
      title: "Flex page",
      url: null,
      width: 400,
      height: 300,
    });
    // Flex layout is preserved on imported containers; children stay absolute
    // so captured browser positions render 1:1.
    const flexScene = scene.children?.[0];
    assert.equal(flexScene?.layoutMode, "horizontal");
    assert.ok(fidelity.score > 0);
    assert.ok(fidelity.flexContainers >= 1);
    const btn = flexScene?.children?.[0];
    assert.ok(btn);
    assert.equal(btn?.x, 16);
  });

  it("preserves shadows and stroke on styled cards", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 300, height: 200 },
      children: [
        node({
          id: "card",
          tagName: "div",
          className: "card",
          rect: { x: 10, y: 10, width: 200, height: 120 },
          styles: {
            display: "block",
            backgroundColor: "rgb(255, 255, 255)",
            borderRadius: "12px",
            border: "1px solid rgb(229, 231, 235)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
          },
          children: [
            node({
              id: "title",
              tagName: "h3",
              text: "Card title",
              rect: { x: 22, y: 22, width: 160, height: 24 },
              styles: { color: "rgb(17, 24, 39)", fontSize: "18px", fontWeight: "700" },
            }),
          ],
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Card",
      url: null,
      width: 300,
      height: 200,
    });
    const card = scene.children?.[0];
    assert.equal(card?.cornerRadius, 12);
    assert.ok((card?.effects?.length ?? 0) >= 1);
    assert.ok((card?.strokeWidth ?? 0) >= 1);
  });

  it("does not create text layers from Tailwind utility class strings", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 400, height: 300 },
      children: [
        node({
          id: "wrapper",
          tagName: "div",
          className: "space-y-1 relative",
          rect: { x: 0, y: 0, width: 400, height: 200 },
          styles: { display: "flex", flexDirection: "column", gap: "4px" },
          children: [
            node({
              id: "junk",
              tagName: "div",
              text: "space-y-1",
              rect: { x: 0, y: 0, width: 80, height: 20 },
              styles: { fontSize: "14px" },
            }),
            node({
              id: "label",
              tagName: "label",
              text: "Email *",
              rect: { x: 0, y: 24, width: 80, height: 20 },
              styles: { fontSize: "14px", fontWeight: "600" },
            }),
          ],
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Form",
      url: null,
      width: 400,
      height: 300,
    });

    const collectText = (n: typeof scene): string[] => {
      const out: string[] = [];
      if (n.type === "text" && n.content) out.push(n.content);
      for (const c of n.children ?? []) out.push(...collectText(c));
      return out;
    };

    const texts = collectText(scene);
    assert.ok(!texts.includes("space-y-1"));
    assert.ok(!texts.includes("relative"));
    assert.ok(texts.includes("Email *"));
  });

  it("preserves side-by-side column positions for 1:1 fidelity", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 1200, height: 800 },
      children: [
        node({
          id: "left",
          tagName: "div",
          className: "auth-panel",
          rect: { x: 0, y: 0, width: 600, height: 800 },
          styles: { display: "block", backgroundColor: "rgb(255, 255, 255)" },
          children: [
            node({
              id: "title",
              tagName: "h1",
              text: "Sign Up",
              rect: { x: 40, y: 80, width: 200, height: 40 },
              styles: { fontSize: "24px", fontWeight: "700" },
            }),
          ],
        }),
        node({
          id: "right",
          tagName: "div",
          className: "hero-panel",
          rect: { x: 600, y: 0, width: 600, height: 800 },
          styles: {
            display: "block",
            backgroundImage: "linear-gradient(rgb(30, 64, 175), rgb(59, 130, 246))",
          },
          children: [
            node({
              id: "hero",
              tagName: "h2",
              text: "Prompt to design",
              rect: { x: 640, y: 120, width: 400, height: 48 },
              styles: { color: "rgb(255, 255, 255)", fontSize: "36px" },
            }),
          ],
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Split page",
      url: null,
      width: 1200,
      height: 800,
    });

    assert.equal(scene.layoutMode, "horizontal");
    assert.equal(scene.children?.length, 2);
    const left = scene.children?.find((c) => c.x < 100);
    const right = scene.children?.find((c) => c.x >= 500);
    assert.equal(left?.x, 0);
    assert.equal(right?.x, 600);
  });

  it("imports styled inputs with stroke and preserved form positions", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 480, height: 600 },
      children: [
        node({
          id: "form",
          tagName: "div",
          className: "flex flex-col space-y-4",
          rect: { x: 40, y: 80, width: 360, height: 280 },
          styles: { display: "flex", flexDirection: "column", gap: "16px" },
          children: [
            node({
              id: "label-fn",
              tagName: "label",
              rect: { x: 40, y: 80, width: 120, height: 20 },
              styles: { fontSize: "14px", fontWeight: "600", color: "rgb(17, 24, 39)" },
              children: [
                node({
                  id: "label-span",
                  tagName: "span",
                  text: "First Name",
                  rect: { x: 40, y: 80, width: 80, height: 20 },
                  styles: { fontSize: "14px" },
                }),
              ],
            }),
            node({
              id: "input-fn",
              tagName: "input",
              placeholder: "Jane",
              rect: { x: 40, y: 116, width: 360, height: 40 },
              styles: {
                backgroundColor: "rgb(255, 255, 255)",
                boxShadow: "rgb(209, 213, 219) 0px 0px 0px 1px inset",
                borderRadius: "6px",
                fontSize: "14px",
                color: "rgb(107, 114, 128)",
              },
            }),
            node({
              id: "btn",
              tagName: "button",
              text: "Continue",
              rect: { x: 40, y: 172, width: 360, height: 44 },
              styles: {
                display: "flex",
                backgroundColor: "rgb(37, 99, 235)",
                color: "rgb(255, 255, 255)",
                fontSize: "15px",
                fontWeight: "600",
                borderRadius: "8px",
              },
            }),
          ],
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Auth form",
      url: null,
      width: 480,
      height: 600,
    });

    const findByName = (n: typeof scene, name: string): typeof scene | undefined => {
      if (n.name === name) return n;
      for (const c of n.children ?? []) {
        const hit = findByName(c, name);
        if (hit) return hit;
      }
      return undefined;
    };

    const form = scene.children?.[0];
    assert.equal(form?.layoutMode, "vertical");

    const input = findByName(scene, "Jane") ?? findByName(scene, "Input");
    assert.ok(input);
    assert.equal(input?.type, "frame");
    assert.equal(input?.strokeEnabled, true);
    assert.ok((input?.strokeWidth ?? 0) >= 1);

    const label = findByName(scene, "First Name");
    assert.equal(label?.type, "text");
    assert.equal(label?.content, "First Name");
  });

  it("preserves child positions after layout inference", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 1200, height: 800 },
      children: [
        node({
          id: "left",
          tagName: "div",
          rect: { x: 0, y: 0, width: 600, height: 800 },
          styles: { backgroundColor: "rgb(255, 255, 255)" },
        }),
        node({
          id: "right",
          tagName: "div",
          rect: { x: 600, y: 0, width: 600, height: 800 },
          styles: { backgroundColor: "rgb(0, 0, 0)" },
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Split page",
      url: null,
      width: 1200,
      height: 800,
    });

    const left = scene.children?.find((c) => c.x < 100);
    const right = scene.children?.find((c) => c.x >= 500);
    assert.equal(left?.x, 0);
    assert.equal(right?.x, 600);
  });

  it("preserves <button> text labels (including buttons with icon children)", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 500, height: 200 },
      children: [
        node({
          id: "email-btn",
          tagName: "button",
          text: "Continue with Email",
          rect: { x: 0, y: 0, width: 500, height: 36 },
          styles: { backgroundColor: "rgb(13, 68, 191)", color: "rgb(255, 255, 255)" },
        }),
        node({
          id: "google-btn",
          tagName: "button",
          text: "Continue with Google",
          rect: { x: 0, y: 48, width: 500, height: 42 },
          styles: { backgroundColor: "rgb(236, 241, 254)", color: "rgb(10, 10, 10)" },
          children: [
            node({
              id: "icon",
              tagName: "svg",
              svgMarkup: "<svg viewBox='0 0 18 18'><rect width='18' height='18'/></svg>",
              rect: { x: 12, y: 12, width: 18, height: 18 },
            }),
          ],
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Buttons",
      url: null,
      width: 500,
      height: 200,
    });

    const allText: string[] = [];
    const collect = (n: typeof scene) => {
      if (n.type === "text" && n.content) allText.push(n.content);
      for (const c of n.children ?? []) collect(c);
    };
    collect(scene);
    assert.ok(allText.includes("Continue with Email"));
    assert.ok(allText.includes("Continue with Google"));
  });

  it("recovers a readable label color on dark buttons", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 500, height: 60 },
      children: [
        node({
          id: "phone-btn",
          tagName: "button",
          text: "Continue with Phone",
          rect: { x: 0, y: 0, width: 500, height: 42 },
          // Extraction yields a dark label color on a near-black button.
          styles: { backgroundColor: "rgb(10, 10, 10)", color: "rgb(10, 10, 10)" },
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Phone",
      url: null,
      width: 500,
      height: 60,
    });

    const findLabel = (n: typeof scene): typeof scene | undefined => {
      if (n.type === "text" && n.content === "Continue with Phone") return n;
      for (const c of n.children ?? []) {
        const hit = findLabel(c);
        if (hit) return hit;
      }
      return undefined;
    };
    const label = findLabel(scene);
    assert.ok(label);
    assert.equal(label?.fill, "#ffffff");
  });

  it("adds background image layer behind children when div has CSS background-image", () => {
    const root = node({
      id: "root",
      tagName: "body",
      rect: { x: 0, y: 0, width: 400, height: 300 },
      children: [
        node({
          id: "hero",
          tagName: "div",
          rect: { x: 0, y: 0, width: 400, height: 300 },
          backgroundImageSrc: "data:image/png;base64,abc",
          styles: {
            backgroundImage: "url(data:image/png;base64,abc)",
            backgroundSize: "cover",
            overflow: "hidden",
          },
          children: [
            node({
              id: "title",
              tagName: "h1",
              text: "Welcome",
              rect: { x: 40, y: 80, width: 200, height: 40 },
              styles: { fontSize: "32px", color: "rgb(255, 255, 255)" },
            }),
          ],
        }),
      ],
    });

    const { scene } = runDesignNativeImport(root, {
      title: "Hero",
      url: null,
      width: 400,
      height: 300,
    });

    const hero = scene.children?.[0];
    assert.equal(hero?.type, "frame");
    assert.equal(hero?.clipChildren, true);
    const bg = hero?.children?.[0];
    assert.equal(bg?.type, "image");
    assert.equal(bg?.name, "Background");
    assert.equal(bg?.x, 0);
    assert.equal(bg?.y, 0);
    assert.equal(bg?.imageFitMode, "crop");
    const title = hero?.children?.[1];
    assert.equal(title?.type, "text");
    assert.equal(title?.content, "Welcome");
    assert.equal(title?.x, 40);
    assert.equal(title?.y, 80);
  });
});
