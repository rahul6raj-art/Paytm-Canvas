import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import type { BridgeCaptureValidationOptions } from "@/lib/craftBridge/bridgeCaptureValidate";

export type BridgeCapturePatternFixture = {
  id: string;
  pattern: string;
  description: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  runFinalize?: boolean;
  validation?: BridgeCaptureValidationOptions;
};

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
  } as EditorNode;
}

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
    codeClassName: extra?.codeClassName,
    ...extra,
  } as EditorNode;
}

/** Known DOM-shape variants for bridge components — not tied to individual screens. */
export const BRIDGE_CAPTURE_PATTERN_FIXTURES: BridgeCapturePatternFixture[] = [
  {
    id: "assurance-badge-inline",
    pattern: "assurance-badge",
    description: "Lock icon + SEBI copy inside pill host",
    runFinalize: true,
    nodes: {
      badge: frame("badge", EDITOR_ROOT_KEY, 240, 8, 120, 24, {
        codeClassName: "ob-flow-header__assurance badge",
        codeJsxTag: "span",
      }),
      icon: frame("icon", "badge", 8, 4, 14, 14, { codeClassName: "badge__icon", codeJsxTag: "svg" }),
      label: textNode("label", "badge", 22, -6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
        codeClassName: "badge__label",
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["badge"],
      badge: ["icon", "label"],
    },
  },
  {
    id: "assurance-badge-split-siblings",
    pattern: "assurance-badge",
    description: "Pill bg with icon + label captured as header siblings",
    runFinalize: true,
    nodes: {
      header: frame("header", EDITOR_ROOT_KEY, 0, 0, 376, 48, {
        codeClassName: "ob-flow__header",
        codeJsxTag: "header",
      }),
      pill: frame("pill", "header", 232, 8, 120, 24, {
        codeClassName: "ob-flow-header__assurance badge",
        fillEnabled: true,
        fill: "#E0F2FE",
        codeJsxTag: "span",
      }),
      icon: frame("icon", "header", 240, 12, 14, 14, {
        codeClassName: "badge__icon",
        codeJsxTag: "svg",
      }),
      label: textNode("label", "header", 258, 6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
        codeClassName: "badge__label",
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["header"],
      header: ["pill", "icon", "label"],
    },
  },
  {
    id: "assurance-header-row",
    pattern: "assurance-badge",
    description: "Icon + SEBI copy in header row without separate pill wrapper",
    runFinalize: true,
    nodes: {
      header: frame("header", EDITOR_ROOT_KEY, 232, 8, 120, 24, {
        codeClassName: "ob-flow-header__assurance",
        codeJsxTag: "div",
      }),
      icon: frame("icon", "header", 8, 4, 14, 14, { codeClassName: "Svg", codeJsxTag: "svg" }),
      label: textNode("label", "header", 22, -6, 98, 40, "Required by SEBI", {
        fontSize: 12,
        lineHeight: 1.333,
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["header"],
      header: ["icon", "label"],
    },
  },
  {
    id: "chip-badge-with-label",
    pattern: "chip-badge",
    description: "Most used chip with label inside pill",
    runFinalize: true,
    nodes: {
      chip: frame("chip", EDITOR_ROOT_KEY, 180, 40, 72, 20, {
        codeClassName: "badge badge--text badge--primary badge--muted",
        fill: "#FFE8D6",
        fillEnabled: true,
        codeJsxTag: "span",
      }),
      label: textNode("label", "chip", 0, 4, 72, 12, "most used", {
        fontSize: 11,
        codeClassName: "badge__label",
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["chip"],
      chip: ["label"],
    },
  },
  {
    id: "chip-badge-orphan-label",
    pattern: "chip-badge",
    description: "Empty chip pill with label sibling",
    runFinalize: true,
    nodes: {
      row: frame("row", EDITOR_ROOT_KEY, 0, 40, 260, 24, { codeClassName: "ob-flow-sig-option__row" }),
      chip: frame("chip", "row", 180, 0, 72, 20, {
        codeClassName: "badge badge--text badge--primary badge--muted",
        fill: "#FFE8D6",
        fillEnabled: true,
        cornerRadius: 10,
        codeJsxTag: "span",
      }),
      label: textNode("label", "row", 186, 4, 60, 12, "Most used", { fontSize: 11 }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["row"],
      row: ["chip", "label"],
    },
  },
  {
    id: "selected-sig-card",
    pattern: "select-card",
    description: "Autogenerated card with positive fill",
    runFinalize: true,
    nodes: {
      card: frame("card", EDITOR_ROOT_KEY, 16, 120, 344, 120, {
        codeClassName: "ob-flow-sig-option ob-flow-sig-option--selected",
        fill: "#E8F5EC",
        fillEnabled: true,
        codeJsxTag: "div",
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["card"],
    },
  },
  {
    id: "checkbox-with-indicator",
    pattern: "checkbox",
    description: "Checkbox row keeps indicator + label",
    runFinalize: true,
    validation: { requireRoundTripMetadata: false },
    nodes: {
      cb: frame("cb", EDITOR_ROOT_KEY, 16, 400, 344, 24, {
        codeClassName: "checkbox",
        codeJsxTag: "label",
      }),
      indicator: frame("indicator", "cb", 0, 0, 24, 24, {
        codeClassName: "checkbox__indicator",
        codeJsxTag: "span",
      }),
      label: textNode("label", "cb", 28, 0, 280, 24, "I am an Indian citizen", {
        codeClassName: "checkbox__label",
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["cb"],
      cb: ["indicator", "label"],
    },
  },
  {
    id: "footer-assurance-row",
    pattern: "footer-assurance",
    description: "Wide footer assurance must not be treated as header pill",
    runFinalize: true,
    validation: { requireRoundTripMetadata: false },
    nodes: {
      row: frame("row", EDITOR_ROOT_KEY, 0, 700, 376, 24, {
        codeClassName: "ob-flow__assurance",
        name: "Your data is 100% safe",
        codeJsxTag: "div",
      }),
      icon: frame("icon", "row", 125, 4, 14, 14, { codeClassName: "Svg", codeJsxTag: "svg" }),
      label: textNode("label", "row", 145, 4, 160, 16, "Your data is 100% safe"),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["row"],
      row: ["icon", "label"],
    },
  },
  {
    id: "outline-stroke-button",
    pattern: "outline-button",
    description: "Green outline CTA (btn--stroke) keeps inside frame stroke",
    runFinalize: true,
    validation: { requireRoundTripMetadata: false },
    nodes: {
      btn: frame("btn", EDITOR_ROOT_KEY, 24, 400, 120, 40, {
        codeClassName: "btn btn--stroke btn--md",
        fillEnabled: false,
        cornerRadius: 20,
        codeJsxTag: "button",
      }),
      label: textNode("label", "btn", 16, 10, 88, 20, "Change Bank", {
        codeClassName: "btn__label",
        textColor: "#34A34D",
        fill: "#34A34D",
        textAlign: "center",
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["btn"],
      btn: ["label"],
    },
  },
  {
    id: "otp-positive-callout",
    pattern: "positive-callout",
    description: "Green info callout keeps readable copy on tinted background",
    runFinalize: true,
    validation: { requireRoundTripMetadata: false },
    nodes: {
      callout: frame("callout", EDITOR_ROOT_KEY, 24, 120, 328, 56, {
        codeClassName: "ob-flow__message text-positive",
        fillEnabled: true,
        fill: "#E8F5EC",
        cornerRadius: 8,
        paddingLeft: 12,
        paddingRight: 12,
        codeJsxTag: "div",
      }),
      label: textNode(
        "label",
        "callout",
        12,
        8,
        304,
        40,
        "UIDAI has sent a temporary OTP to your mobile ending in ****** (valid for 10 mins).",
        {
          codeClassName: "text-positive",
          textColor: "#158939",
          fill: "#158939",
          fontSize: 12,
          lineHeight: 1.4,
        },
      ),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["callout"],
      callout: ["label"],
    },
  },
  {
    id: "subtitle-overflow-clamp",
    pattern: "body-subtitle",
    description: "Long subtitle clamps to parent column width",
    runFinalize: true,
    validation: { requireRoundTripMetadata: false },
    nodes: {
      body: frame("body", EDITOR_ROOT_KEY, 0, 200, 376, 80, {
        codeClassName: "ob-flow__body",
        paddingLeft: 24,
        paddingRight: 24,
        codeJsxTag: "div",
      }),
      subtitle: textNode(
        "subtitle",
        "body",
        0,
        0,
        420,
        28,
        "Please enter OTP to complete verification",
        {
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.3,
        },
      ),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["body"],
      body: ["subtitle"],
    },
  },
  {
    id: "single-line-section-heading",
    pattern: "section-heading",
    description: "Screen title and section labels stay on one line",
    runFinalize: true,
    validation: { requireRoundTripMetadata: false },
    nodes: {
      body: frame("body", EDITOR_ROOT_KEY, 0, 120, 376, 240, {
        codeClassName: "ob-flow__body",
        paddingLeft: 24,
        paddingRight: 24,
        codeJsxTag: "div",
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
      section: textNode("section", "body", 0, 56, 90, 20, "Citizenship", {
        fontSize: 14,
        fontWeight: 600,
        browserTextLayout: {
          content: "Citizenship",
          lines: [{ text: "Citizenship", startIndex: 0, x: 0, y: 0, width: 88, height: 18 }],
        },
      }),
    },
    childOrder: {
      [EDITOR_ROOT_KEY]: ["body"],
      body: ["title", "section"],
    },
  },
];
