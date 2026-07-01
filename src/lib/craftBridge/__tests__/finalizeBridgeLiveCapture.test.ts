import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import { normalizeBottomNavTextNodes } from "@/lib/webImport/normalizeWebImportLayers";
import { textLayoutForEditorNode } from "@/lib/text/canonicalTextLayout";
import { textVerticalPad } from "@/lib/text/textNodeModel";
import {
  captureCenteredGroupParents,
  clampBottomNavWidths,
  fitBridgeCaptureTextBounds,
  finalizeBridgeLiveCapture,
  layoutBridgeCaptureTextNode,
  pinBridgeCaptureChildren,
  recenterCapturedGroups,
  applyInlineRowAutoLayout,
  coalesceBridgeInlineTextRows,
  tightenBridgeCaptureTextBounds,
  ensureBridgeCaptureTextVisible,
  fitBridgeSingleLineTextFrames,
  separateBridgeFooterConsentFromButton,
  layoutBridgeBadgeRows,
  applyBridgeCaptureCraftTextSemantics,
  ensureBridgeTextFitsOwnFrame,
  ensureBridgeTextOnFilledParent,
  clampBridgeTextToParentBounds,
  expandBridgeSingleLineTextWidths,
  fitBridgeFooterLinkText,
  consolidateBridgeCompactControlBorderEdges,
  finalizeBridgeOtpDigitRowChrome,
  layoutBridgePositiveCalloutText,
  clampBridgeTextToColumnWidth,
  stripBridgeCompactInputCaretLayers,
  prepareBridgeCalloutFrames,
  ensureBridgeSelectedCardInsetStrokes,
  ensureBridgeOutlinedControlStrokes,
  stripBridgeSpuriousIconButtonStrokes,
  stripBridgeButtonBorderEdgeSegments,
  splitBridgeConsentLinkRuns,
  reflowBridgeConsentTcRow,
  centerBridgeButtonLabels,
  ensureBridgeCaptureFrameStrokes,
  alignBridgeTextfieldFloatingLabels,
  stripBridgeOutlineOnlyControlFills,
  preserveBridgeCapturedEdgeLayers,
  resolveBridgeTextfieldCornerStyle,
  normalizeBridgeCaptureFontWeights,
  normalizeBridgeCaptureTextTypography,
} from "../finalizeBridgeLiveCapture";
import { bridgeCaptureLineCapPx } from "../browserCaptureTextLayout";

function textNode(
  id: string,
  parentId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    content,
    fontSize: 12,
    textAlign: "left",
    ...extra,
  } as EditorNode;
}

function frame(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<EditorNode>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    ...extra,
  };
}

describe("finalizeBridgeLiveCapture", () => {
  it("clamps bottom nav bar width without changing x", () => {
    const nodes: Record<string, EditorNode> = {
      bn: frame("bn", "root", 0, 714, 388, 130, { codeClassName: "bn" }),
      bar: frame("bar", "bn", 0, 32, 388, 98, { codeClassName: "bn__bar" }),
    };

    clampBottomNavWidths(nodes);
    assert.equal(nodes.bar?.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(nodes.bar?.x, 0);
    assert.equal(nodes.bn?.width, PML_PHONE_COLUMN_WIDTH);
  });

  it("preserves section horizontal inset (does not zero x)", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 80, 80, PML_PHONE_COLUMN_WIDTH, 844, {
        codeClassName: "pml-more",
      }),
      section: frame("section", "root", 16, 120, 360, 200, {
        codeClassName: "sh-section",
      }),
      content: frame("content", "section", 0, 56, 360, 136, {
        codeClassName: "sh-section__content",
        layoutMode: "vertical",
        layoutGap: 12,
      }),
      card: frame("card", "content", 0, 0, 344, 96, { codeClassName: "card" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["section"],
      section: ["content"],
      content: ["card"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);
    assert.equal(nodes.section?.x, 16, "section margin must stay at captured inset");
    assert.equal(nodes.card?.parentId, "content", "BEM content wrapper kept for layer organization");
    assert.equal(nodes.content?.name, "sh-section__content");
    assert.equal(nodes.card?.x, 0);
    assert.equal(nodes.card?.layoutPositioning, "absolute");
    assert.equal(nodes.section?.layoutMode, "none");
  });

  it("locks phone shell artboard to column width", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 80, 80, 390, 844, { codeClassName: "pml-more" }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["root"] };

    finalizeBridgeLiveCapture(nodes, childOrder);
    assert.equal(nodes.root?.width, PML_PHONE_COLUMN_WIDTH);
    assert.equal(nodes.root?.clipChildren, true);
  });

  it("pinBridgeCaptureChildren keeps measured coordinates", () => {
    const nodes: Record<string, EditorNode> = {
      row: frame("row", "root", 0, 24, 280, 68, {
        codeClassName: "li-item__secondary-row",
        layoutMode: "horizontal",
      }),
      text: frame("text", "row", 0, 0, 280, 20),
    };
    const childOrder = { row: ["text"] };

    pinBridgeCaptureChildren(nodes, childOrder);
    assert.equal(nodes.text?.layoutPositioning, "absolute");
    assert.equal(nodes.text?.y, 0);
  });

  it("re-centers an icon+text group after the text widens (justify-content: center)", () => {
    // Browser-centered: icon 14w at x=125, text 106w at x=145 → group 125..251, centered in 376.
    const nodes: Record<string, EditorNode> = {
      row: frame("row", "root", 0, 0, 376, 50, { codeClassName: "ob-flow__assurance" }),
      icon: frame("icon", "row", 125, 12, 14, 14, { codeClassName: "Svg" }),
      label: {
        id: "label",
        parentId: "row",
        type: "text",
        name: "assurance",
        x: 145,
        y: 13,
        width: 106,
        height: 14,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Your data is 100% safe",
        fontSize: 12,
        textAlign: "left",
      } as EditorNode,
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["row"], row: ["icon", "label"] };

    const centered = captureCenteredGroupParents(nodes, childOrder);
    assert.ok(centered.has("row"), "assurance row should be detected as centered");

    // Simulate text widening to 136 (Craft Inter) — group now 125..281, off-center.
    nodes.label = { ...nodes.label!, width: 136 };
    recenterCapturedGroups(nodes, childOrder, centered);

    const minX = Math.min(nodes.icon!.x, nodes.label!.x);
    const maxX = Math.max(nodes.icon!.x + nodes.icon!.width, nodes.label!.x + nodes.label!.width);
    const groupCenter = (minX + maxX) / 2;
    assert.ok(Math.abs(groupCenter - 188) <= 1, `group center ${groupCenter} should be ~188`);
  });

  it("does not treat a left-aligned label group as centered", () => {
    const nodes: Record<string, EditorNode> = {
      cb: frame("cb", "root", 0, 0, 344, 24, { codeClassName: "checkbox" }),
      indicator: frame("indicator", "cb", 0, 0, 24, 24, { codeClassName: "checkbox__indicator" }),
      label: {
        id: "label",
        parentId: "cb",
        type: "text",
        name: "label",
        x: 28,
        y: 0,
        width: 200,
        height: 24,
        rotation: 0,
        visible: true,
        locked: false,
        content: "I am an Indian citizen",
        textAlign: "left",
      } as EditorNode,
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["cb"], cb: ["indicator", "label"] };
    const centered = captureCenteredGroupParents(nodes, childOrder);
    assert.ok(!centered.has("cb"), "left-aligned checkbox row must not be re-centered");
  });

  it("keeps a centered label centered in a roomy box (e.g. button)", () => {
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "btn",
        type: "text",
        name: "Continue",
        x: 80,
        y: 12,
        width: 200, // roomy button label box → real captures size labels to button width
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Continue",
        fontSize: 16,
        textAlign: "center",
        textResizeMode: "fixed",
      } as EditorNode,
    };
    fitBridgeCaptureTextBounds(nodes);
    assert.equal(nodes.label?.x, 80);
    assert.equal(nodes.label?.width, 200);
    assert.equal(nodes.label?.textResizeMode, "fixed");
    assert.equal(nodes.label?.height, 20);
    assert.equal(nodes.label?.verticalAlign, "top");
  });

  it("preserves captured left edge for badge labels without remeasure widening", () => {
    // Tight centered text (badge label) right of an icon: must not grow left into the icon.
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "badge",
        type: "text",
        name: "Required by SEBI",
        x: 22,
        y: 2,
        width: 98,
        height: 15,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Required by SEBI",
        fontSize: 12,
        textAlign: "center",
        textResizeMode: "fixed",
      } as EditorNode,
    };
    fitBridgeCaptureTextBounds(nodes);
    assert.equal(nodes.label?.x, 22);
    assert.equal(nodes.label?.width, 98);
  });

  it("preserves captured DOM width for left-aligned labels", () => {
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "card",
        type: "text",
        name: "Appearance",
        x: 16,
        y: 12,
        width: 28,
        height: 20,
        content: "Appearance",
        fontSize: 16,
        textAlign: "left",
        textResizeMode: "fixed",
      } as EditorNode,
    };
    fitBridgeCaptureTextBounds(nodes);
    assert.equal(nodes.label?.x, 16);
    assert.equal(nodes.label?.width, 28);
    assert.equal(nodes.label?.textResizeMode, "fixed");
    assert.equal(nodes.label?.height, 20);
    assert.equal(nodes.label?.verticalAlign, "top");
  });

  it("centers captured text vertically so it sits on the browser line box", () => {
    const nodes: Record<string, EditorNode> = {
      label: textNode("label", "row", 9, 15, 126, 22, "Mobile number", {
        fontSize: 16,
        lineHeight: 1.375,
        verticalAlign: "top",
      }),
    };
    fitBridgeCaptureTextBounds(nodes);
    assert.equal(nodes.label?.verticalAlign, "top");
  });

  it("does not coalesce ob-flow-form__tc-text rows so link colors stay separate", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 312, 24, { codeClassName: "ob-flow-form__tc-text" }),
      a: textNode("a", "tc", -4, 4, 152, 16, "I agree to Paytm Money's", { lineHeight: 1.333 }),
      linkA: frame("linkA", "tc", 147, 4, 45, 16, { codeClassName: "ob-flow-form__link" }),
      linkAlabel: textNode("linkAlabel", "linkA", -4, 0, 49, 16, "T&Cs"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["a", "linkA"],
      linkA: ["linkAlabel"],
    };

    coalesceBridgeInlineTextRows(nodes, childOrder);

    assert.equal(childOrder.tc?.length, 2);
    assert.ok(nodes.linkAlabel);
  });

  it("coalesces an inline link row into one editable text layer", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 312, 24, { codeClassName: "card__legal-row" }),
      a: textNode("a", "tc", -4, 4, 152, 16, "I agree to Paytm Money's", { lineHeight: 1.333 }),
      linkA: frame("linkA", "tc", 147, 4, 45, 16, { codeClassName: "ob-flow-form__link" }),
      linkAlabel: textNode("linkAlabel", "linkA", -4, 0, 49, 16, "T&Cs"),
      amp: textNode("amp", "tc", 176, 4, 17, 16, "&", { lineHeight: 1.333 }),
      linkB: frame("linkB", "tc", 191, 4, 84, 16, { codeClassName: "ob-flow-form__link" }),
      linkBlabel: textNode("linkBlabel", "linkB", -4, 0, 88, 16, "Privacy Policy"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["a", "linkA", "amp", "linkB"],
      linkA: ["linkAlabel"],
      linkB: ["linkBlabel"],
    };

    coalesceBridgeInlineTextRows(nodes, childOrder);

    assert.equal(childOrder.tc?.length, 1);
    const merged = nodes[childOrder.tc![0]!];
    assert.equal(merged?.type, "text");
    assert.match(merged?.content ?? "", /I agree to Paytm Money's/);
    assert.match(merged?.content ?? "", /T&Cs/);
    assert.match(merged?.content ?? "", /Privacy Policy/);
    assert.equal(nodes.a, undefined);
    assert.equal(nodes.linkA, undefined);
  });

  it("coalesces inline rows using link label bounds, not tall button frames", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 312, 24, { codeClassName: "ob-flow-form__tc-text" }),
      a: textNode("a", "tc", 0, 4, 152, 16, "I agree to Paytm Money's", { lineHeight: 1.333, fontSize: 12 }),
      linkA: frame("linkA", "tc", 147, 0, 45, 133, { codeClassName: "ob-flow-form__link" }),
      linkAlabel: textNode("linkAlabel", "linkA", 0, 58, 45, 16, "T&Cs", { fontSize: 12, lineHeight: 1.333 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["a", "linkA"],
      linkA: ["linkAlabel"],
    };

    coalesceBridgeInlineTextRows(nodes, childOrder);

    const merged = nodes[childOrder.tc![0]!];
    assert.ok((merged?.height ?? 0) <= 22, `merged height ${merged?.height} should hug one line`);
  });

  it("does not coalesce a vertical stack (title over subtitle)", () => {
    const nodes: Record<string, EditorNode> = {
      card: frame("card", "root", 0, 0, 200, 60, { codeClassName: "card" }),
      title: textNode("title", "card", 0, 0, 120, 20, "Title"),
      sub: textNode("sub", "card", 0, 24, 160, 18, "Subtitle"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["card"],
      card: ["title", "sub"],
    };
    coalesceBridgeInlineTextRows(nodes, childOrder);
    assert.equal(childOrder.card?.length, 2);
  });

  it("restores bottom nav label visibility after bridge capture", () => {
    const nodes: Record<string, EditorNode> = {
      tab: frame("tab", "bn", 0, 0, 78, 56),
      label: textNode("label", "tab", 8, 28, 2, 2, "Stocks", {
        codeClassName: "bn__label body-medium",
        fontSize: 12,
        textColor: "var(--text-secondary)",
        fill: "var(--text-secondary)",
      }),
    };
    const childOrder = { tab: ["label"] };

    normalizeBottomNavTextNodes(nodes);
    ensureBridgeCaptureTextVisible(nodes);

    assert.equal(nodes.label?.textColor, "#575757");
    assert.ok((nodes.label?.width ?? 0) >= 40);
    assert.ok((nodes.label?.height ?? 0) >= 12);
  });

  it("keeps all bottom nav labels visible through full finalize", () => {
    const labels = ["Home", "Stocks", "F&O", "MF", "More"];
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, PML_PHONE_COLUMN_WIDTH, 844, {
        codeClassName: "pml-more",
        manualScreenLayout: true,
        bridgeSourcePath: "pages/More",
      }),
      bn: frame("bn", "root", 0, 788, 376, 56, { codeClassName: "bn" }),
    };
    const childOrder: Record<string, string[]> = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["bn"],
      bn: [],
    };
    labels.forEach((label, i) => {
      const tabId = `tab${i}`;
      const labelId = `label${i}`;
      nodes[tabId] = frame(tabId, "bn", i * 75, 0, 75, 40, { clipChildren: true });
      nodes[labelId] = textNode(labelId, tabId, 8, 28, 2, 2, label, {
        codeClassName: "bn__label body-medium",
        fontSize: 12,
        textColor: "var(--text-secondary)",
        fill: "var(--text-secondary)",
      });
      childOrder.bn!.push(tabId);
      childOrder[tabId] = [labelId];
    });

    finalizeBridgeLiveCapture(nodes, childOrder);

    for (let i = 0; i < labels.length; i++) {
      const labelNode = nodes[`label${i}`];
      assert.equal(labelNode?.content, labels[i]);
      assert.equal(labelNode?.textResizeMode, "fixed");
      assert.ok((labelNode?.width ?? 0) >= 30, `${labels[i]} width ${labelNode?.width}`);
      assert.ok((labelNode?.height ?? 0) >= 12, `${labels[i]} height ${labelNode?.height}`);
    }
  });

  it("keeps list item primary and secondary as separate layers through finalize", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, PML_PHONE_COLUMN_WIDTH, 844, {
        codeClassName: "pml-more",
        manualScreenLayout: true,
        bridgeSourcePath: "pages/More",
      }),
      row: frame("row", "root", 16, 200, 344, 72, { codeJsxTag: "ListItem" }),
      primary: textNode("primary", "row", 56, 12, 200, 20, "Start onboarding", {
        codeClassName: "li-item__primary",
        fontSize: 16,
      }),
      secondary: textNode("secondary", "row", 56, 36, 260, 18, "Full KYC flow from welcome to activation", {
        codeClassName: "li-item__secondary",
        fontSize: 13,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["row"],
      row: ["primary", "secondary"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    assert.equal(nodes.primary?.content, "Start onboarding");
    assert.equal(nodes.secondary?.content, "Full KYC flow from welcome to activation");
    assert.notEqual(nodes.primary?.content?.includes("Full KYC"), true);
    assert.equal(nodes.primary?.x, 56, "Playwright x preserved");
    assert.equal(nodes.secondary?.width, 260, "Playwright width preserved");
    assert.equal(nodes.primary?.textResizeMode, "fixed");
    assert.equal(nodes.secondary?.textResizeMode, "fixed");
  });

  it("layoutBridgeCaptureTextNode never shrinks below captured DOM height", () => {
    const node = {
      id: "label",
      type: "text",
      name: "Dark theme",
      x: 0,
      y: 16,
      width: 90,
      height: 20,
      content: "Dark theme",
      fontSize: 14,
      lineHeight: 1.27,
      textResizeMode: "auto-width",
    } as EditorNode;
    const next = layoutBridgeCaptureTextNode(node, "Dark theme");
    assert.ok((next.height ?? 0) >= 20, `height ${next.height}`);
  });

  it("colors link labels blue even when class matches generic ob-flow-form", () => {
    const nodes: Record<string, EditorNode> = {
      link: textNode("link", "tc", 0, 0, 45, 16, "T&Cs", {
        codeClassName: "ob-flow-form__link body-medium",
      }),
      privacy: textNode("privacy", "tc", 50, 0, 88, 16, "Privacy Policy", {
        codeClassName: "ob-flow-form__link",
        fill: "var(--color-link)",
      }),
    };
    ensureBridgeCaptureTextVisible(nodes);
    assert.equal(nodes.link?.fill, "#0066CC");
    assert.equal(nodes.privacy?.fill, "#0066CC");
    assert.equal(nodes.link?.textDecoration, "underline");
    assert.equal(nodes.privacy?.textDecoration, "underline");
  });

  it("splits KYC consent copy into body and underlined Read more link", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 312, 24, { codeClassName: "ob-flow-form__tc-text" }),
      merged: textNode(
        "merged",
        "tc",
        0,
        4,
        280,
        16,
        "I give my consent to Online KYC, inc… Read more",
        { fontSize: 12, lineHeight: 1.333 },
      ),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["merged"],
    };

    splitBridgeConsentLinkRuns(nodes, childOrder);
    ensureBridgeCaptureTextVisible(nodes);

    assert.equal(nodes.merged, undefined);
    assert.equal(childOrder.tc?.length, 2);
    const readMore = childOrder.tc!.map((id) => nodes[id]!).find((n) => n.content === "Read more");
    assert.ok(readMore);
    assert.equal(readMore?.textDecoration, "underline");
    assert.equal(readMore?.fill, "#0066CC");
  });

  it("splits a merged consent sentence into gray body and blue link runs", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 312, 24, { codeClassName: "ob-flow-form__tc-text" }),
      merged: textNode(
        "merged",
        "tc",
        0,
        4,
        280,
        16,
        "I agree to Paytm Money's T&Cs & Privacy Policy",
        { fontSize: 12, lineHeight: 1.333 },
      ),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["merged"],
    };

    splitBridgeConsentLinkRuns(nodes, childOrder);

    assert.equal(nodes.merged, undefined);
    assert.equal(childOrder.tc?.length, 4);
    const runs = childOrder.tc!.map((id) => nodes[id]!);
    assert.equal(runs.filter((n) => n.fill === "#0066CC").length, 2);
    assert.ok(runs.some((n) => n.content === "T&Cs"));
    assert.ok(runs.some((n) => n.content === "Privacy Policy"));
    assert.equal(runs.find((n) => n.content === "T&Cs")?.textDecoration, "underline");
    assert.equal(runs.find((n) => n.content === "Privacy Policy")?.textDecoration, "underline");
  });

  it("clamps an inflated input placeholder to one line and centers it", () => {
    const nodes: Record<string, EditorNode> = {
      input: frame("input", "root", 0, 0, 320, 52, { codeClassName: "textfield_input" }),
      ph: textNode("ph", "input", 13, 16, 117, 138, "Mobile number", {
        fontSize: 16,
        lineHeight: 1.375,
      }),
    };
    fitBridgeSingleLineTextFrames(nodes);
    assert.ok((nodes.ph?.height ?? 0) <= 26, `height ${nodes.ph?.height}`);
    assert.equal(nodes.ph?.verticalAlign, "top");
    assert.ok((nodes.ph?.y ?? 0) >= 12 && (nodes.ph?.y ?? 0) <= 18);
  });

  it("reflows consent inline runs on one baseline beside the checkbox", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 300, 24, { codeClassName: "ob-flow-form__tc" }),
      cb: frame("cb", "tc", 0, 0, 20, 20, { codeClassName: "checkbox__indicator" }),
      a: textNode("a", "tc", 28, 8, 152, 20, "I agree to Paytm Money's ", { fontSize: 12 }),
      linkA: frame("linkA", "tc", 180, 2, 45, 20, { codeClassName: "ob-flow-form__link" }),
      linkAlabel: textNode("linkAlabel", "linkA", 0, 4, 45, 16, "T&Cs", { fontSize: 12 }),
      amp: textNode("amp", "tc", 225, 10, 10, 16, " & ", { fontSize: 12 }),
      linkB: frame("linkB", "tc", 235, 0, 90, 22, { codeClassName: "ob-flow-form__link" }),
      linkBlabel: textNode("linkBlabel", "linkB", 0, 6, 90, 16, "Privacy Policy", { fontSize: 12 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["cb", "a", "linkA", "amp", "linkB"],
      linkA: ["linkAlabel"],
      linkB: ["linkBlabel"],
    };

    reflowBridgeConsentTcRow(nodes, childOrder);

    const ys = [nodes.a?.y, nodes.linkAlabel?.y, nodes.amp?.y, nodes.linkBlabel?.y];
    assert.equal(new Set(ys).size, 1, `shared baseline ${ys.join(",")}`);
    assert.equal(nodes.linkA, undefined, "link wrapper flattened");
    assert.ok((nodes.linkAlabel?.x ?? 0) > (nodes.a?.x ?? 0) + (nodes.a?.width ?? 0) - 2);
    assert.ok((nodes.amp?.x ?? 0) > (nodes.linkAlabel?.x ?? 0) + (nodes.linkAlabel?.width ?? 0) - 2);
  });

  it("reflows consent copy inside ob-flow-form__tc-text wrapper", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 0, 0, 344, 24, { codeClassName: "ob-flow-form__tc" }),
      cb: frame("cb", "tc", 0, 0, 20, 20, { codeClassName: "checkbox" }),
      tcText: frame("tcText", "tc", 32, 0, 312, 20, { codeClassName: "ob-flow-form__tc-text" }),
      a: textNode("a", "tcText", 0, 4, 143, 15, "I agree to Paytm Money's", { fontSize: 12 }),
      linkA: frame("linkA", "tcText", 147, 0, 30, 16, {}),
      linkAlabel: textNode("linkAlabel", "linkA", 0, 0, 40, 15, "T&Cs", { fontSize: 12 }),
      amp: textNode("amp", "tcText", 180, 4, 8, 15, "&", { fontSize: 12 }),
      linkB: frame("linkB", "tcText", 191, 0, 79, 16, {}),
      linkBlabel: textNode("linkBlabel", "linkB", 0, 0, 79, 15, "Privacy Policy", { fontSize: 12 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["cb", "tcText"],
      tcText: ["a", "linkA", "amp", "linkB"],
      linkA: ["linkAlabel"],
      linkB: ["linkBlabel"],
    };

    reflowBridgeConsentTcRow(nodes, childOrder);

    assert.equal(nodes.linkA, undefined);
    assert.equal(nodes.linkB, undefined);
    assert.ok((nodes.linkAlabel?.x ?? 0) > (nodes.a?.x ?? 0) + (nodes.a?.width ?? 0));
    assert.ok((nodes.amp?.x ?? 0) > (nodes.linkAlabel?.x ?? 0) + (nodes.linkAlabel?.width ?? 0));
    assert.ok((nodes.linkBlabel?.x ?? 0) > (nodes.amp?.x ?? 0) + (nodes.amp?.width ?? 0));
  });

  it("normalizes body copy font weight 500 to 400", () => {
    const nodes: Record<string, EditorNode> = {
      body: textNode("body", "root", 0, 0, 100, 16, "Mobile number", {
        fontSize: 16,
        fontWeight: 500,
        codeClassName: "body-medium textfield",
      }),
      title: textNode("title", "root", 0, 24, 200, 24, "Enter mobile number", {
        fontSize: 24,
        fontWeight: 600,
        codeClassName: "sh__title",
      }),
    };
    normalizeBridgeCaptureFontWeights(nodes);
    assert.equal(nodes.body?.fontWeight, 400);
    assert.equal(nodes.title?.fontWeight, 600);
  });

  it("lifts overlapping consent copy above the primary button", () => {
    const nodes: Record<string, EditorNode> = {
      form: frame("form", "root", 0, 700, 320, 120, { codeClassName: "ob-flow-form" }),
      tc: frame("tc", "form", 0, 40, 300, 24, { codeClassName: "ob-flow-form__tc" }),
      consent: textNode("consent", "tc", 28, 4, 270, 24, "I agree to Paytm Money's T&Cs", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
      btn: frame("btn", "form", 0, 58, 320, 48, { codeClassName: "btn" }),
      btnLabel: textNode("btnLabel", "btn", 0, 14, 320, 20, "Verify via OTP"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["form"],
      form: ["tc", "btn"],
      tc: ["consent"],
      btn: ["btnLabel"],
    };

    separateBridgeFooterConsentFromButton(nodes, childOrder);

    const tcAbsY = nodes.tc!.y + nodes.form!.y;
    const btnAbsY = nodes.btn!.y + nodes.form!.y;
    assert.ok(tcAbsY + nodes.tc!.height + 10 <= btnAbsY);
  });

  it("centers badge labels beside the lock icon", () => {
    const nodes: Record<string, EditorNode> = {
      badge: frame("badge", "root", 240, 8, 120, 24, { codeClassName: "header__assurance badge" }),
      icon: frame("icon", "badge", 8, 4, 14, 14),
      label: textNode("label", "badge", 22, -6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["badge"],
      badge: ["icon", "label"],
    };

    layoutBridgeBadgeRows(nodes, childOrder);

    const iconCy = (nodes.icon?.y ?? 0) + (nodes.icon?.height ?? 0) / 2;
    const labelCy = (nodes.label?.y ?? 0) + (nodes.label?.height ?? 0) / 2;
    assert.ok(Math.abs(iconCy - labelCy) <= 1, `icon center ${iconCy} vs label ${labelCy}`);
    assert.ok(Math.abs((nodes.label?.x ?? 0) - 28) <= 2);
    assert.equal(nodes.label?.textAlign, "left");
    assert.ok((nodes.icon?.x ?? 0) <= 10);
    assert.ok((nodes.label?.x ?? 0) >= (nodes.icon?.x ?? 0) + (nodes.icon?.width ?? 0));
  });

  it("preserves captured DOM width when laying out badge rows", () => {
    const nodes: Record<string, EditorNode> = {
      badge: frame("badge", "root", 240, 8, 120, 24, { codeClassName: "header__assurance badge" }),
      icon: frame("icon", "badge", 8, 4, 14, 14),
      label: textNode("label", "badge", 22, 2, 98, 15, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
        textResizeMode: "fixed",
        verticalAlign: "middle",
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["badge"],
      badge: ["icon", "label"],
    };

    layoutBridgeBadgeRows(nodes, childOrder);

    assert.equal(nodes.label?.width, 98);
    assert.equal(nodes.label?.textResizeMode, "fixed");
    assert.equal(nodes.label?.verticalAlign, "top");
  });

  it("applyBridgeCaptureCraftTextSemantics uses Craft layout not browser paint", () => {
    const nodes: Record<string, EditorNode> = {
      hint: textNode("hint", EDITOR_ROOT_KEY, 24, 0, 299, 15, "All transactions will go securely", {
        fontSize: 12,
        lineHeight: 1.333,
        textResizeMode: "auto-width",
        verticalAlign: "top",
      }),
    };
    nodes.hint!.browserTextLayout = {
      content: "All transactions will go securely",
      lines: [{ text: "All transactions will go securely", startIndex: 0, x: 0, y: 0, width: 299, height: 15, baselineY: 13 }],
    };

    applyBridgeCaptureCraftTextSemantics(nodes);

    assert.equal(nodes.hint?.verticalAlign, "top");
    assert.equal(nodes.hint?.textResizeMode, "fixed");
    assert.equal(nodes.hint?.browserTextLayout, undefined);
    assert.equal(nodes.hint?.bridgeDomTextBox, true);
    assert.ok((nodes.hint?.height ?? 0) >= 15);
  });

  it("bridgeDomTextBox skips Craft fixed-text vertical inset so DOM-sized labels do not clip", () => {
    assert.equal(textVerticalPad("fixed", { bridgeDomTextBox: true }), 0);
    assert.equal(textVerticalPad("fixed", {}), 2);

    const nodes: Record<string, EditorNode> = {
      label: textNode("label", "root", 0, 0, 40, 15, "Bank", {
        fontSize: 12,
        lineHeight: 1.333,
        textResizeMode: "fixed",
        verticalAlign: "middle",
      }),
    };

    applyBridgeCaptureCraftTextSemantics(nodes);

    assert.equal(nodes.label?.bridgeDomTextBox, true);
    const prepared = textLayoutForEditorNode(nodes.label!);
    assert.ok(prepared);
    const firstY = prepared!.canonical.lines[0]?.y ?? -1;
    assert.ok(firstY >= 0, `label glyphs should not paint above box (y=${firstY})`);
  });

  it("ensureBridgeTextFitsOwnFrame expands short boxes so glyphs are not self-clipped", () => {
    const nodes: Record<string, EditorNode> = {
      label: textNode("label", "root", 0, 0, 120, 8, "Your data is 100% safe", {
        fontSize: 12,
        lineHeight: 1.333,
        textResizeMode: "fixed",
        verticalAlign: "middle",
      }),
    };

    ensureBridgeTextFitsOwnFrame(nodes);

    assert.equal(nodes.label?.verticalAlign, "top");
    assert.equal(nodes.label?.bridgeDomTextBox, true);
    assert.ok((nodes.label?.height ?? 0) >= 12, `height ${nodes.label?.height}`);
  });

  it("footer assurance row keeps label visible after finalize", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", EDITOR_ROOT_KEY, 0, 0, 376, 800, {
        manualScreenLayout: true,
        bridgeSourcePath: "screens/bank.tsx",
      }),
      row: frame("row", "root", 0, 700, 376, 24, {
        codeClassName: "ob-flow__assurance",
        name: "Your data is 100% safe",
      }),
      icon: frame("icon", "row", 125, 4, 14, 14, { codeClassName: "Svg" }),
      label: textNode("label", "row", 145, 4, 160, 16, "Your data is 100% safe", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["row"],
      row: ["icon", "label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    assert.equal(nodes.label?.bridgeDomTextBox, true);
    assert.ok((nodes.label?.height ?? 0) >= 16);
    assert.equal(nodes.row?.clipChildren, false);
  });

  it("keeps positive callout text readable on tinted background", () => {
    const nodes: Record<string, EditorNode> = {
      callout: frame("callout", "root", 24, 120, 328, 56, {
        codeClassName: "ob-flow__message text-positive",
        fillEnabled: true,
        fill: "#E8F5EC",
      }),
      label: textNode("label", "callout", 12, 8, 304, 40, "UIDAI has sent a temporary OTP", {
        codeClassName: "text-positive",
        textColor: "#E8F5EC",
        fill: "#E8F5EC",
      }),
    };

    ensureBridgeTextOnFilledParent(nodes);

    assert.equal(nodes.label?.textColor, "#158939");
    assert.equal(nodes.label?.fill, "#158939");
  });

  it("merges OTP digit border hairlines into one frame stroke", () => {
    const nodes: Record<string, EditorNode> = {
      digit: frame("digit", "row", 0, 0, 48, 48, {
        codeClassName: "otp-digit",
        codeJsxTag: "input",
        fillEnabled: true,
        fill: "#FFFFFF",
      }),
      left: frame("left", "digit", 0, 0, 1, 48, {
        codeClassName: "craft-capture-edge-left",
        fillEnabled: true,
        fill: "#E0E0E0",
      }),
      right: frame("right", "digit", 47, 0, 1, 48, {
        codeClassName: "craft-capture-edge-right",
        fillEnabled: true,
        fill: "#E0E0E0",
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["row"],
      row: ["digit"],
      digit: ["left", "right"],
    };

    consolidateBridgeCompactControlBorderEdges(nodes, childOrder);

    assert.equal(nodes.left, undefined);
    assert.equal(nodes.right, undefined);
    assert.equal(childOrder.digit?.length, 0);
    assert.equal(nodes.digit?.strokeEnabled, true);
    assert.equal(nodes.digit?.strokeColor?.toLowerCase(), "#e0e0e0");
  });

  it("removes full-width horizontal hairline behind OTP digit row", () => {
    const nodes: Record<string, EditorNode> = {
      input: frame("input", "root", 24, 300, 328, 48, {
        name: "Input",
        codeClassName: "otp__inputs",
      }),
      hairline: frame("hairline", "input", 0, 23, 328, 1, {
        codeClassName: "craft-capture-edge-bottom",
        fillEnabled: true,
        fill: "#E0E0E0",
      }),
      d1: frame("d1", "input", 0, 0, 48, 48, { name: "Digit 1 of 6", codeJsxTag: "input" }),
      d2: frame("d2", "input", 56, 0, 48, 48, { name: "Digit 2 of 6", codeJsxTag: "input" }),
      d3: frame("d3", "input", 112, 0, 48, 48, { name: "Digit 3 of 6", codeJsxTag: "input" }),
      d4: frame("d4", "input", 168, 0, 48, 48, { name: "Digit 4 of 6", codeJsxTag: "input" }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["input"],
      input: ["hairline", "d1", "d2", "d3", "d4"],
    };

    finalizeBridgeOtpDigitRowChrome(nodes, childOrder);

    assert.equal(nodes.hairline, undefined);
    assert.deepEqual(childOrder.input, ["d1", "d2", "d3", "d4"]);
  });

  it("shows UIDAI callout copy inside the green message box", () => {
    const nodes: Record<string, EditorNode> = {
      callout: frame("callout", "root", 24, 120, 328, 56, {
        codeClassName: "ob-flow__message text-positive",
        fillEnabled: true,
        fill: "#E8F5EC",
        paddingLeft: 12,
        paddingRight: 12,
        clipChildren: true,
      }),
      label: textNode(
        "label",
        "callout",
        12,
        8,
        304,
        16,
        "UIDAI has sent a temporary OTP to your mobile ending in ****** (valid for 10 mins).",
        {
          codeClassName: "text-positive",
          textColor: "#E8F5EC",
          fill: "#E8F5EC",
          fontSize: 12,
          lineHeight: 1.4,
        },
      ),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["callout"], callout: ["label"] };

    layoutBridgePositiveCalloutText(nodes, childOrder);

    assert.equal(nodes.label?.textColor, "#158939");
    assert.ok((nodes.label?.height ?? 0) > 20);
    assert.ok((nodes.callout?.height ?? 0) > 56);
    assert.equal(nodes.callout?.clipChildren, false);
  });

  it("clamps section subtitle to phone column using absolute bounds", () => {
    const nodes: Record<string, EditorNode> = {
      body: frame("body", "root", 0, 200, 376, 80, {
        codeClassName: "ob-flow__body",
        paddingLeft: 24,
        paddingRight: 24,
      }),
      subtitle: textNode("subtitle", "body", 0, 0, 420, 28, "Please enter OTP to complete verification", {
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1.3,
      }),
    };

    clampBridgeTextToColumnWidth(nodes);

    assert.equal(nodes.subtitle?.width, 328);
  });

  it("does not crush right-aligned header badge or pan-card labels", () => {
    const nodes: Record<string, EditorNode> = {
      header: frame("header", "root", 0, 0, 376, 48, { codeClassName: "ob-flow__header" }),
      badge: frame("badge", "header", 258, 6, 98, 24, { codeClassName: "badge" }),
      sebi: textNode("sebi", "badge", 22, 2, 98, 15, "Required by SEBI"),
      card: frame("card", "root", 24, 200, 328, 120, { codeClassName: "ob-flow-pan-card" }),
      dob: textNode("dob", "card", 80, 0, 72, 16, "Date of Birth", {
        codeClassName: "dp__top-label",
      }),
    };

    clampBridgeTextToColumnWidth(nodes);

    assert.equal(nodes.sebi?.width, 98);
    assert.equal(nodes.sebi?.height, 15);
    assert.equal(nodes.dob?.width, 72);
    assert.equal(nodes.dob?.height, 16);
  });

  it("keeps Resend OTP on one line", () => {
    const nodes: Record<string, EditorNode> = {
      footer: frame("footer", "root", 0, 400, 328, 40, {
        codeClassName: "otp_footer-row",
        paddingLeft: 24,
        paddingRight: 24,
      }),
      timer: textNode("timer", "footer", 120, 0, 72, 40, "Resend OTP", {
        codeClassName: "otp_timer",
        fontSize: 14,
        lineHeight: 20,
        lineHeightUnit: "PIXELS",
      }),
    };

    fitBridgeFooterLinkText(nodes);

    assert.ok((nodes.timer?.width ?? 0) > 72);
    assert.ok((nodes.timer?.height ?? 0) <= 22);
  });

  it("does not clip right-aligned Forgot my PIN link", () => {
    const nodes: Record<string, EditorNode> = {
      footer: frame("footer", "root", 0, 400, 328, 40, {
        codeClassName: "ob-flow__footer-zone",
        paddingLeft: 24,
        paddingRight: 24,
      }),
      link: textNode("link", "footer", 220, 0, 60, 40, "Forgot my PIN", {
        codeClassName: "ob-flow-form__link",
        fontSize: 14,
        lineHeight: 20,
        lineHeightUnit: "PIXELS",
        textAlign: "right",
      }),
    };

    fitBridgeFooterLinkText(nodes);

    assert.ok((nodes.link?.width ?? 0) >= 100);
    assert.equal((nodes.link?.x ?? 0) + (nodes.link?.width ?? 0), 304);
    assert.equal(nodes.link?.content, "Forgot my PIN");
  });

  it("does not clip positive callout copy after layout", () => {
    const nodes: Record<string, EditorNode> = {
      callout: frame("callout", "root", 24, 120, 328, 56, {
        codeClassName: "ob-flow__message text-positive",
        fillEnabled: true,
        fill: "#E8F5EC",
        clipChildren: true,
      }),
      label: textNode("label", "callout", 12, 8, 304, 40, "UIDAI has sent a temporary OTP", {
        codeClassName: "text-positive",
        textColor: "#E8F5EC",
        fill: "#E8F5EC",
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["callout"], callout: ["label"] };

    prepareBridgeCalloutFrames(nodes, childOrder);

    assert.equal(nodes.callout?.clipChildren, false);
    assert.equal(nodes.label?.textColor, "#158939");
  });

  it("clamps overflowing subtitle to parent content width", () => {
    const nodes: Record<string, EditorNode> = {
      body: frame("body", "root", 0, 200, 376, 80, {
        paddingLeft: 24,
        paddingRight: 24,
      }),
      subtitle: textNode("subtitle", "body", 0, 0, 420, 28, "Please enter OTP to complete verification", {
        fontSize: 18,
      }),
    };

    clampBridgeTextToParentBounds(nodes);

    assert.equal(nodes.subtitle?.x, 24);
    assert.equal(nodes.subtitle?.width, 328);
    assert.equal(nodes.subtitle?.bridgeDomTextBox, true);
  });

  it("expands narrow single-line heading so Craft does not wrap onto extra lines", () => {
    const nodes: Record<string, EditorNode> = {
      body: frame("body", "root", 0, 100, 376, 200, {
        paddingLeft: 24,
        paddingRight: 24,
        codeClassName: "ob-flow__body",
      }),
      title: textNode("title", "body", 0, 0, 180, 32, "Tell us more about you", {
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1.25,
        browserTextLayout: {
          content: "Tell us more about you",
          lines: [
            { text: "Tell us more about you", startIndex: 0, x: 0, y: 0, width: 280, height: 30 },
          ],
        },
      }),
      section: textNode("section", "body", 0, 48, 90, 20, "Citizenship", {
        fontSize: 14,
        fontWeight: 600,
        browserTextLayout: {
          content: "Citizenship",
          lines: [{ text: "Citizenship", startIndex: 0, x: 0, y: 0, width: 88, height: 18 }],
        },
      }),
    };

    expandBridgeSingleLineTextWidths(nodes);
    applyBridgeCaptureCraftTextSemantics(nodes);

    assert.ok((nodes.title?.width ?? 0) > 240, `title width ${nodes.title?.width}`);
    assert.ok((nodes.section?.width ?? 0) > 90, `section width ${nodes.section?.width}`);
    const lineCap = bridgeCaptureLineCapPx(nodes.title!);
    assert.ok((nodes.title?.height ?? 0) <= lineCap * 1.6);
  });

  it("centers badge labels through full finalize", () => {
    const nodes: Record<string, EditorNode> = {
      badge: frame("badge", "root", 240, 8, 120, 24, { codeClassName: "header__assurance badge" }),
      icon: frame("icon", "badge", 8, 4, 14, 14),
      label: textNode("label", "badge", 22, -6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["badge"],
      badge: ["icon", "label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    const iconCy = (nodes.icon?.y ?? 0) + (nodes.icon?.height ?? 0) / 2;
    const labelCy = (nodes.label?.y ?? 0) + (nodes.label?.height ?? 0) / 2;
    assert.ok(Math.abs(iconCy - labelCy) <= 1);
  });

  it("centers text-only chip badges and keeps most used label visible", () => {
    const nodes: Record<string, EditorNode> = {
      chip: frame("chip", "root", 180, 40, 72, 20, {
        codeClassName: "badge badge--text badge--primary badge--muted",
        fill: "#FFE8D6",
        fillEnabled: true,
      }),
      label: textNode("label", "chip", 0, 4, 72, 12, "most used", {
        fontSize: 11,
        textColor: "var(--text-secondary)",
        fill: "var(--text-secondary)",
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["chip"],
      chip: ["label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    assert.equal(nodes.label?.content, "most used");
    assert.ok((nodes.label?.textColor ?? "").length > 0);
    assert.ok(Math.abs((nodes.label?.x ?? 0) + (nodes.label?.width ?? 0) / 2 - (nodes.chip?.width ?? 0) / 2) <= 4);
    assert.ok(Math.abs((nodes.label?.y ?? 0) + (nodes.label?.height ?? 0) / 2 - (nodes.chip?.height ?? 0) / 2) <= 2);
  });

  it("reparents sibling chip copy into an empty badge pill before layout", () => {
    const nodes: Record<string, EditorNode> = {
      row: frame("row", EDITOR_ROOT_KEY, 0, 40, 260, 24),
      chip: frame("chip", "row", 180, 0, 72, 20, {
        codeClassName: "badge badge--text badge--primary badge--muted",
        fill: "#FFE8D6",
        fillEnabled: true,
        cornerRadius: 10,
      }),
      label: textNode("label", "row", 186, 4, 60, 12, "Most used", {
        fontSize: 11,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["row"],
      row: ["chip", "label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    assert.equal(nodes.label?.parentId, "chip");
    assert.equal(nodes.label?.content, "Most used");
    assert.ok(Math.abs((nodes.label?.x ?? 0) + (nodes.label?.width ?? 0) / 2 - (nodes.chip?.width ?? 0) / 2) <= 6);
  });

  it("aligns assurance header badges without a badge class token", () => {
    const nodes: Record<string, EditorNode> = {
      badge: frame("badge", EDITOR_ROOT_KEY, 240, 8, 120, 24, {
        codeClassName: "ob-flow-header__assurance",
      }),
      icon: frame("icon", "badge", 8, 4, 14, 14),
      label: textNode("label", "badge", 22, -6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["badge"],
      badge: ["icon", "label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    const iconCy = (nodes.icon?.y ?? 0) + (nodes.icon?.height ?? 0) / 2;
    const labelCy = (nodes.label?.y ?? 0) + (nodes.label?.height ?? 0) / 2;
    assert.ok(Math.abs(iconCy - labelCy) <= 1);
  });

  it("reparents split SEBI icon and label into the assurance pill", () => {
    const nodes: Record<string, EditorNode> = {
      header: frame("header", EDITOR_ROOT_KEY, 0, 0, 376, 48, { codeClassName: "ob-flow__header" }),
      pill: frame("pill", "header", 232, 8, 120, 24, {
        codeClassName: "ob-flow-header__assurance badge",
        fillEnabled: true,
        fill: "#E0F2FE",
      }),
      icon: frame("icon", "header", 240, 12, 14, 14, { codeClassName: "badge__icon" }),
      label: textNode("label", "header", 258, 6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["header"],
      header: ["pill", "icon", "label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    assert.equal(nodes.icon?.parentId, "pill");
    assert.equal(nodes.label?.parentId, "pill");
    const iconCy = (nodes.icon?.y ?? 0) + (nodes.icon?.height ?? 0) / 2;
    const labelCy = (nodes.label?.y ?? 0) + (nodes.label?.height ?? 0) / 2;
    assert.ok(Math.abs(iconCy - labelCy) <= 1, `icon ${iconCy} vs label ${labelCy}`);
  });

  it("aligns SEBI copy when icon and label share a header row without a pill wrapper", () => {
    const nodes: Record<string, EditorNode> = {
      header: frame("header", EDITOR_ROOT_KEY, 232, 8, 120, 24, {
        codeClassName: "ob-flow-header__assurance",
      }),
      icon: frame("icon", "header", 8, 4, 14, 14, { codeClassName: "Svg" }),
      label: textNode("label", "header", 22, -6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["header"],
      header: ["icon", "label"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    const iconCy = (nodes.icon?.y ?? 0) + (nodes.icon?.height ?? 0) / 2;
    const labelCy = (nodes.label?.y ?? 0) + (nodes.label?.height ?? 0) / 2;
    assert.ok(Math.abs(iconCy - labelCy) <= 1);
  });

  it("adds green inset stroke to selected sig cards by class or positive fill", () => {
    const nodes: Record<string, EditorNode> = {
      selectedClass: frame("selectedClass", EDITOR_ROOT_KEY, 0, 0, 320, 120, {
        codeClassName: "ob-flow-sig-option ob-flow-sig-option--selected",
        fill: "#E8F5EC",
        fillEnabled: true,
      }),
      selectedFill: frame("selectedFill", EDITOR_ROOT_KEY, 0, 140, 320, 120, {
        codeClassName: "ob-flow-sig-option",
        fill: "#E8F5EC",
        fillEnabled: true,
      }),
      plain: frame("plain", EDITOR_ROOT_KEY, 0, 280, 320, 120, {
        codeClassName: "ob-flow-sig-option",
        fill: "#FFFFFF",
        fillEnabled: true,
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["selectedClass", "selectedFill", "plain"],
    };

    ensureBridgeSelectedCardInsetStrokes(nodes, {});

    assert.equal(nodes.selectedClass?.strokeEnabled, true);
    assert.ok((nodes.selectedClass?.strokeWidth ?? 0) >= 0.5);
    assert.equal(nodes.selectedFill?.strokeEnabled, true);
    assert.notEqual(nodes.plain?.strokeEnabled, true);
  });

  it("adds green stroke to btn--stroke when capture dropped the border", () => {
    const tokenCss = ":root { --border-positive-strong: #34A34D; }";
    const nodes: Record<string, EditorNode> = {
      btn: frame("btn", EDITOR_ROOT_KEY, 24, 400, 120, 40, {
        codeClassName: "btn btn--stroke btn--md",
        fillEnabled: false,
        cornerRadius: 20,
      }),
      label: textNode("label", "btn", 16, 10, 88, 20, "Change Bank"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["btn"],
      btn: ["label"],
    };

    ensureBridgeOutlinedControlStrokes(nodes, childOrder, {
      cssSources: [tokenCss],
      theme: "light",
    });

    assert.equal(nodes.btn?.strokeEnabled, true);
    assert.ok((nodes.btn?.strokeWidth ?? 0) >= 0.5);
    assert.equal(nodes.btn?.strokeColor?.toLowerCase(), "#34a34d");
  });

  it("normalizes inside stroke on btn--stroke when border was already captured", () => {
    const nodes: Record<string, EditorNode> = {
      btn: frame("btn", EDITOR_ROOT_KEY, 24, 400, 344, 52, {
        codeClassName: "btn btn--stroke btn--large",
        fillEnabled: true,
        fill: "#ffffff",
        strokeEnabled: true,
        strokeWidth: 1,
        strokeColor: "#34a34d",
        cornerRadius: 200,
      }),
      label: textNode("label", "btn", 16, 14, 105, 24, "Change Bank"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["btn"],
      btn: ["label"],
    };

    ensureBridgeOutlinedControlStrokes(nodes, childOrder, { theme: "light" });

    assert.equal(nodes.btn?.strokePosition, "inside");
    assert.equal(nodes.btn?.strokeColor?.toLowerCase(), "#34a34d");
  });

  it("does not add outline stroke to header__icon-btn back arrow", () => {
    const nodes: Record<string, EditorNode> = {
      back: frame("back", EDITOR_ROOT_KEY, 16, 60, 40, 40, {
        codeClassName: "header__icon-btn header__back-btn",
        fillEnabled: false,
        cornerRadius: 200,
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["back"], back: [] };

    ensureBridgeOutlinedControlStrokes(nodes, childOrder, { theme: "light" });
    stripBridgeSpuriousIconButtonStrokes(nodes);

    assert.notEqual(nodes.back?.strokeEnabled, true);
  });

  it("promotes captured edge hairlines to btn frame stroke", () => {
    const nodes: Record<string, EditorNode> = {
      btn: frame("btn", EDITOR_ROOT_KEY, 0, 0, 120, 40, {
        codeClassName: "btn btn--stroke",
        fillEnabled: false,
      }),
      edgeTop: frame("edgeTop", "btn", 0, 0, 120, 1, {
        codeClassName: "craft-capture-edge-top",
        fill: "rgb(52, 163, 77)",
        fillEnabled: true,
      }),
      label: textNode("label", "btn", 8, 10, 100, 20, "Change Bank"),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["btn"],
      btn: ["edgeTop", "label"],
    };

    stripBridgeButtonBorderEdgeSegments(nodes, childOrder);

    assert.equal(nodes.edgeTop, undefined);
    assert.equal(nodes.btn?.strokeEnabled, true);
    assert.equal(nodes.btn?.strokeColor?.toLowerCase(), "#34a34d");
  });

  it("does not inflate percent line-height (133) to px during bridge finalize", () => {
    const nodes: Record<string, EditorNode> = {
      label: textNode("label", "root", 22, 2, 98, 15, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 133,
      }),
    };
    normalizeBridgeCaptureTextTypography(nodes);
    finalizeBridgeLiveCapture(nodes, { [EDITOR_ROOT_KEY]: ["label"] });
    assert.equal(nodes.label?.lineHeightUnit, "percent");
    assert.equal(nodes.label?.height, 15, "captured DOM height preserved");
  });

  it("does not shift text when browser layout coords exceed the captured box", () => {
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "badge",
        type: "text",
        name: "Required by SEBI",
        x: 22,
        y: 2,
        width: 98,
        height: 15,
        content: "Required by SEBI",
        fontSize: 12,
        textResizeMode: "fixed",
      } as EditorNode,
    };
    nodes.label!.browserTextLayout = {
      content: "Required by SEBI",
      lines: [
        {
          text: "Required by SEBI",
          startIndex: 0,
          x: 22,
          y: 40,
          width: 98,
          height: 15,
          baselineY: 52,
        },
      ],
    };

    tightenBridgeCaptureTextBounds(nodes);

    assert.equal(nodes.label?.x, 22);
    assert.equal(nodes.label?.y, 2);
    assert.equal(nodes.label?.height, 15);
    assert.equal(nodes.label?.browserTextLayout?.lines[0]?.y, 0);
  });

  it("rebases overflowing browser layout for brand taglines without shifting DOM position", () => {
    const nodes: Record<string, EditorNode> = {
      tagline: {
        id: "tagline",
        parentId: "brand",
        type: "text",
        name: "Investments simplified",
        x: 95,
        y: 168,
        width: 200,
        height: 16,
        content: "Investments simplified",
        fontSize: 12,
        textColor: "var(--text-secondary)",
        textResizeMode: "fixed",
        codeClassName: "ob-flow-welcome__tagline body-small",
      } as EditorNode,
    };
    nodes.tagline!.browserTextLayout = {
      content: "Investments simplified",
      lines: [
        {
          text: "Investments simplified",
          startIndex: 0,
          x: 0,
          y: 22,
          width: 180,
          height: 14,
          baselineY: 34,
        },
      ],
    };

    tightenBridgeCaptureTextBounds(nodes);
    ensureBridgeCaptureTextVisible(nodes);

    assert.equal(nodes.tagline?.x, 95);
    assert.equal(nodes.tagline?.y, 168);
    assert.equal(nodes.tagline?.browserTextLayout?.lines[0]?.y, 0);
    assert.equal(nodes.tagline?.textColor, "#575757");
  });

  it("shrinks inflated text to browser line ink bounds", () => {
    const nodes: Record<string, EditorNode> = {
      label: {
        id: "label",
        parentId: "root",
        type: "text",
        name: "eyebrow",
        x: 108,
        y: 152,
        width: 160,
        height: 143,
        content: "Create Account for Free",
        fontSize: 14,
        textResizeMode: "auto-height",
      } as EditorNode,
    };
    nodes.label!.browserTextLayout = {
      content: "Create Account for Free",
      lines: [
        {
          text: "Create Account for Free",
          startIndex: 0,
          x: 0,
          y: 62,
          width: 160,
          height: 20,
          baselineY: 80,
        },
      ],
    };

    tightenBridgeCaptureTextBounds(nodes);

    assert.equal(nodes.label?.y, 214);
    assert.equal(nodes.label?.height, bridgeCaptureLineCapPx(nodes.label!));
    assert.equal(nodes.label?.textResizeMode, "fixed");
  });

  it("expands clipping row when label extends below captured flex height", () => {
    const nodes: Record<string, EditorNode> = {
      root: frame("root", null, 0, 0, PML_PHONE_COLUMN_WIDTH, 844, {
        codeClassName: "pml-more",
      }),
      row: frame("row", "root", 16, 100, 320, 28, {
        codeClassName: "pml-more-theme-card",
        clipChildren: true,
      }),
      label: {
        id: "label",
        parentId: "row",
        type: "text",
        name: "Dark theme",
        x: 16,
        y: 16,
        width: 90,
        height: 20,
        rotation: 0,
        visible: true,
        locked: false,
        content: "Dark theme",
        fontSize: 14,
        lineHeight: 1.27,
        codeClassName: "pml-more-theme-card__label body-medium",
        textResizeMode: "fixed",
      } as EditorNode,
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["root"],
      root: ["row"],
      row: ["label"],
    };
    finalizeBridgeLiveCapture(nodes, childOrder);
    assert.equal(nodes.row?.height, 28, "bridge capture keeps captured frame height");
    assert.equal(nodes.label?.height, 20, "captured text height preserved");
    assert.equal(nodes.label?.y, 16);
  });

  it("reflows stacked consent fragments through full finalize", () => {
    const nodes: Record<string, EditorNode> = {
      tc: frame("tc", "root", 16, 700, 344, 24, { codeClassName: "ob-flow-form__tc" }),
      cb: frame("cb", "tc", 0, 0, 20, 20, { codeClassName: "checkbox__indicator" }),
      a: textNode("a", "tc", 28, 0, 140, 20, "I agree to Paytm Money's ", { fontSize: 12 }),
      linkA: frame("linkA", "tc", 28, 0, 30, 20, { codeClassName: "ob-flow-form__link" }),
      linkAlabel: textNode("linkAlabel", "linkA", 0, 0, 30, 16, "T&Cs", {
        fontSize: 12,
        fill: "#0066CC",
      }),
      amp: textNode("amp", "tc", 28, 0, 8, 16, " & ", { fontSize: 12 }),
      linkB: frame("linkB", "tc", 28, 0, 79, 20, { codeClassName: "ob-flow-form__link" }),
      linkBlabel: textNode("linkBlabel", "linkB", 0, 0, 79, 16, "Privacy Policy", {
        fontSize: 12,
        fill: "#0066CC",
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["tc"],
      tc: ["cb", "a", "linkA", "amp", "linkB"],
      linkA: ["linkAlabel"],
      linkB: ["linkBlabel"],
    };

    finalizeBridgeLiveCapture(nodes, childOrder);

    assert.equal(nodes.linkA, undefined, "link wrapper flattened");
    assert.ok((nodes.linkAlabel?.x ?? 0) > (nodes.a?.x ?? 0) + (nodes.a?.width ?? 0) - 2);
    assert.ok((nodes.amp?.x ?? 0) > (nodes.linkAlabel?.x ?? 0) + (nodes.linkAlabel?.width ?? 0) - 2);
    assert.ok((nodes.linkBlabel?.x ?? 0) > (nodes.amp?.x ?? 0) + (nodes.amp?.width ?? 0) - 2);
    assert.equal(nodes.linkAlabel?.textDecoration, "underline");
    assert.equal(nodes.linkBlabel?.textDecoration, "underline");
    const ys = [nodes.a?.y, nodes.linkAlabel?.y, nodes.amp?.y, nodes.linkBlabel?.y];
    assert.equal(new Set(ys).size, 1, `shared baseline ${ys.join(",")}`);
  });

  it("synthesizes textfield outline when capture drops the border stroke", () => {
    const tokenCss = ":root { --border-neutral-medium: #E0E0E0; }";
    const nodes: Record<string, EditorNode> = {
      input: frame("input", "root", 16, 200, 344, 52, { name: "Input" }),
      ph: textNode("ph", "input", 16, 16, 120, 20, "Mobile number", {
        fontSize: 16,
        textColor: "#9ca3af",
      }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["input"],
      input: ["ph"],
    };
    ensureBridgeCaptureFrameStrokes(nodes, childOrder, { cssSources: [tokenCss], theme: "light" });
    assert.equal(nodes.input?.strokeEnabled, true);
    assert.equal(nodes.input?.strokeColor, "#E0E0E0");
    assert.equal(nodes[`input__tf-border`], undefined, "stroke is editable on the input frame");
  });

  it("preserves synthetic bridge divider layers as editable fills", () => {
    const nodes: Record<string, EditorNode> = {
      edge: frame("edge", "footer", 0, 0, 344, 1, {
        codeClassName: "craft-capture-edge-top",
        fill: "#E0E0E0",
        fillEnabled: true,
        locked: true,
      }),
    };
    const childOrder = { footer: ["edge"], edge: [] as string[] };
    preserveBridgeCapturedEdgeLayers(nodes);
    assert.equal(nodes.edge?.name, "divider");
    assert.equal(nodes.edge?.fillEnabled, true);
    assert.equal(nodes.edge?.locked, false);
    assert.equal(nodes.edge?.layoutPositioning, "absolute");
  });

  it("keeps captured textfield__box stroke and removes gray fill", () => {
    const nodes: Record<string, EditorNode> = {
      box: frame("box", "root", 16, 200, 344, 52, {
        codeClassName: "textfield__box",
        fill: "#f5f5f5",
        fillEnabled: true,
        strokeColor: "#d0d0d0",
        strokeWidth: 1,
        strokeEnabled: true,
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["box"], box: [] as string[] };
    stripBridgeOutlineOnlyControlFills(nodes);
    ensureBridgeCaptureFrameStrokes(nodes, childOrder);
    assert.equal(nodes.box?.strokeEnabled, true);
    assert.equal(nodes.box?.strokeColor, "#d0d0d0");
    assert.equal(nodes.box?.fillEnabled, false);
    assert.equal(nodes[`box__tf-border`], undefined, "stroke lives on the box frame");
  });

  it("normalizes captured focus-green textfield stroke to project token grey", () => {
    const tokenCss = ":root { --border-neutral-medium: #E0E0E0; }";
    const nodes: Record<string, EditorNode> = {
      box: frame("box", "root", 16, 200, 344, 52, {
        codeClassName: "textfield__box",
        strokeColor: "#34A34D",
        strokeWidth: 1,
        strokeEnabled: true,
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["box"], box: [] as string[] };
    ensureBridgeCaptureFrameStrokes(nodes, childOrder, { cssSources: [tokenCss], theme: "light" });
    assert.equal(nodes.box?.strokeColor, "#E0E0E0");
  });

  it("aligns floated Mobile number label on the top border", () => {
    const nodes: Record<string, EditorNode> = {
      box: frame("box", "root", 16, 200, 344, 52, { codeClassName: "textfield__box" }),
      label: textNode("label", "box", 12, 14, 96, 20, "Mobile number", {
        codeClassName: "textfield__label textfield__label--float",
        fontSize: 14,
        lineHeight: 20,
        lineHeightUnit: "px",
      }),
    };
    const childOrder = { [EDITOR_ROOT_KEY]: ["box"], box: ["label"] };
    alignBridgeTextfieldFloatingLabels(nodes, childOrder);
    assert.equal(nodes.label?.y, -10);
    assert.equal(nodes.box?.clipChildren, false);
  });

  it("uses textfield__box captured corner radius on the border layer", () => {
    const tokenCss = ":root { --border-neutral-medium: #E0E0E0; }";
    const nodes: Record<string, EditorNode> = {
      input: frame("input", "root", 16, 200, 344, 52, { name: "Input" }),
      box: frame("box", "input", 0, 0, 344, 52, {
        codeClassName: "textfield__box",
        cornerRadius: 12,
      }),
      ph: textNode("ph", "box", 16, 16, 120, 20, "Mobile number", { fontSize: 16 }),
    };
    const childOrder = {
      [EDITOR_ROOT_KEY]: ["input"],
      input: ["box"],
      box: ["ph"],
    };
    ensureBridgeCaptureFrameStrokes(nodes, childOrder, { cssSources: [tokenCss], theme: "light" });
    assert.equal(nodes.box?.strokeEnabled, true);
    assert.equal(nodes.box?.cornerRadius, 12);
    assert.equal(nodes[`box__tf-border`], undefined);
    assert.equal(childOrder.box?.[0], "ph");
  });

  it("resolveBridgeTextfieldCornerStyle reads radius from nested textfield__box", () => {
    const nodes: Record<string, EditorNode> = {
      input: frame("input", "root", 0, 0, 344, 52, { name: "Input" }),
      box: frame("box", "input", 0, 0, 344, 52, {
        codeClassName: "textfield__box",
        cornerRadius: 16,
      }),
    };
    const childOrder = { input: ["box"], box: [] as string[] };
    const style = resolveBridgeTextfieldCornerStyle("input", nodes, childOrder);
    assert.equal(style.cornerRadius, 16);
  });
});
