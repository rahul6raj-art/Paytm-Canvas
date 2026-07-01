import type { EditorNode } from "@/stores/useEditorStore";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  bridgeCaptureLineCapPx,
  bridgeTextWrapsAtCapturedWidth,
} from "@/lib/craftBridge/browserCaptureTextLayout";
import { isBridgeTextInsideTextfield } from "@/lib/craftBridge/bridgeTextfieldTextLayout";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";

/** Strict live → canvas fidelity tolerance (px). */
export const BRIDGE_CAPTURE_FIDELITY_TOLERANCE_PX = 1;

const ASSURANCE_HEADER_COPY_RE = /required by sebi/i;
const FOOTER_ASSURANCE_COPY_RE = /your data is 100% safe/i;
const CHIP_LABEL_MAX_LEN = 24;

export type BridgeCaptureValidationIssue = {
  rule: string;
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
};

export type BridgeCaptureValidationResult = {
  ok: boolean;
  errors: BridgeCaptureValidationIssue[];
  warnings: BridgeCaptureValidationIssue[];
};

export type BridgeCaptureValidationOptions = {
  /** Fail import when errors exist (default true). */
  strict?: boolean;
  tolerancePx?: number;
  /** Require code linkage fields for canvas → code round trip. */
  requireRoundTripMetadata?: boolean;
  /** When false, skip phone-column artboard width checks (desktop / Storybook captures). */
  expectPhoneArtboard?: boolean;
};

function absoluteOffset(
  nodeId: string,
  nodes: Record<string, EditorNode>,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let cur: EditorNode | undefined = nodes[nodeId];
  while (cur) {
    x += cur.x;
    y += cur.y;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return { x, y };
}

function visibleChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): EditorNode[] {
  return (childOrder[parentId] ?? [])
    .map((id) => nodes[id])
    .filter((n): n is EditorNode => !!n && n.visible !== false);
}

function isBridgeBadgePillFrame(frame: EditorNode): boolean {
  const cls = frame.codeClassName ?? "";
  const w = frame.width ?? 0;
  const h = frame.height ?? 0;
  if (/\bob-flow__assurance\b/i.test(cls) && w > 180) return false;
  if (FOOTER_ASSURANCE_COPY_RE.test(frame.name ?? "")) return false;
  if (/\bbadge\b/i.test(cls)) return true;
  if (/header__assurance|ob-flow-header__assurance/i.test(cls)) return true;
  if (/__assurance\b/i.test(cls) && w <= 200 && h <= 48) return true;
  if (/\b(?:chip|tag)\b/i.test(cls) && h <= 28) return true;
  const radius = frame.cornerRadius ?? 0;
  if (frame.fillEnabled && h >= 14 && h <= 28 && w >= 28 && w <= 140 && radius >= 8) {
    return /\b(?:badge|chip|tag|muted|pill)\b/i.test(cls);
  }
  return false;
}

function isBridgeBadgeIconNode(node: EditorNode | undefined): boolean {
  if (!node || node.type === "text") return false;
  const cls = node.codeClassName ?? "";
  if (/\bbadge__icon\b|__assurance-icon\b|__icon-wrap\b/i.test(cls)) return true;
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  if (w >= 8 && w <= 24 && h >= 8 && h <= 24) return true;
  const name = (node.name ?? "").toLowerCase();
  if ((name === "svg" || name.includes("icon")) && w <= 32 && h <= 32) return true;
  return false;
}

function findIconNearLabel(
  label: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode | undefined {
  const labelAbs = absoluteOffset(label.id, nodes);
  let best: EditorNode | undefined;
  let bestScore = Infinity;

  const visit = (parentId: string): void => {
    for (const kid of visibleChildren(nodes, childOrder, parentId)) {
      if (kid.id === label.id) continue;
      if (isBridgeBadgeIconNode(kid)) {
        const kidAbs = absoluteOffset(kid.id, nodes);
        if (kidAbs.x >= labelAbs.x) continue;
        const gap = labelAbs.x - (kidAbs.x + kid.width);
        if (gap > 24) continue;
        const labelCy = labelAbs.y + label.height / 2;
        const iconCy = kidAbs.y + kid.height / 2;
        const score = Math.abs(iconCy - labelCy) * 10 + Math.max(0, gap);
        if (score < bestScore) {
          bestScore = score;
          best = kid;
        }
      }
      if (kid.type === "frame" || kid.type === "group") visit(kid.id);
    }
  };

  let rootId: string | undefined = label.parentId ?? undefined;
  while (rootId) {
    visit(rootId);
    const parent = nodes[rootId];
    if (!parent?.parentId) break;
    rootId = parent.parentId;
    if ((nodes[rootId]?.height ?? 0) > 64) break;
  }

  return best;
}

function frameHasTextDescendant(
  frameId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  for (const kid of visibleChildren(nodes, childOrder, frameId)) {
    if (kid.type === "text" && (kid.content ?? "").trim()) return true;
    if (kid.type === "frame" || kid.type === "group") {
      if (frameHasTextDescendant(kid.id, nodes, childOrder)) return true;
    }
  }
  return false;
}

function isBridgeSelectedCardFrame(node: EditorNode): boolean {
  const cls = node.codeClassName ?? "";
  if (/\bob-flow-[a-z0-9-]+--selected\b/i.test(cls)) return true;
  if (!/\bob-flow-(?:select-card|sig-option|signature-option|sig-card)\b/i.test(cls)) {
    return false;
  }
  if (node.fillEnabled !== true) return false;
  const fill = node.fill?.trim().toLowerCase() ?? "";
  if (!fill || fill === "#ffffff" || fill === "#fff") return false;
  return /#[eE][0-9a-fA-F]{5}/.test(fill) || fill.includes("f5") || fill.includes("e8");
}

function validateAssuranceHeaderBadges(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  tolerancePx: number,
): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const node of Object.values(nodes)) {
    if (node.type !== "text" || !ASSURANCE_HEADER_COPY_RE.test(node.content ?? "")) continue;
    const icon = findIconNearLabel(node, nodes, childOrder);
    if (!icon) {
      issues.push({
        rule: "assurance-header-badge-icon",
        severity: "error",
        message: `"Required by SEBI" label is missing a lock icon within 24px (${node.id}).`,
        nodeId: node.id,
      });
      continue;
    }
    const labelAbs = absoluteOffset(node.id, nodes);
    const iconAbs = absoluteOffset(icon.id, nodes);
    const labelInkH = node.bridgeDomTextBox ? bridgeCaptureLineCapPx(node) : node.height;
    const labelCy = labelAbs.y + labelInkH / 2;
    const iconCy = iconAbs.y + icon.height / 2;
    const delta = Math.abs(labelCy - iconCy);
    if (delta > tolerancePx) {
      issues.push({
        rule: "assurance-header-badge-alignment",
        severity: "error",
        message: `"Required by SEBI" icon/text vertical center delta ${delta.toFixed(1)}px exceeds ${tolerancePx}px (${node.id}).`,
        nodeId: node.id,
      });
    }
  }
  return issues;
}

function validateChipBadgeLabels(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame" || !isBridgeBadgePillFrame(node)) continue;
    if (ASSURANCE_HEADER_COPY_RE.test(node.name ?? "")) continue;
    if (frameHasTextDescendant(id, nodes, childOrder)) continue;
    const w = node.width ?? 0;
    const h = node.height ?? 0;
    if (w > 140 || h > 28) continue;
    issues.push({
      rule: "chip-badge-label",
      severity: "error",
      message: `Badge/chip pill has fill but no visible label text (${id}, class=${node.codeClassName ?? ""}).`,
      nodeId: id,
    });
  }
  return issues;
}

function validateSelectedCardStrokes(
  nodes: Record<string, EditorNode>,
): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame" || !isBridgeSelectedCardFrame(node)) continue;
    const hasStroke =
      node.strokeEnabled === true &&
      (node.strokeWidth ?? 0) >= 0.5 &&
      Boolean(node.strokeColor?.trim());
    if (!hasStroke) {
      issues.push({
        rule: "selected-card-stroke",
        severity: "error",
        message: `Selected card is missing green inset stroke (${id}, class=${node.codeClassName ?? ""}).`,
        nodeId: id,
      });
    }
  }
  return issues;
}

function validateCheckboxIndicators(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    const cls = node.codeClassName ?? "";
    if (!/\bcheckbox\b/i.test(cls) || /\bcheckbox__label\b/i.test(cls)) continue;
    const kids = visibleChildren(nodes, childOrder, id);
    const hasIndicator = kids.some(
      (k) =>
        k.type !== "text" &&
        (/\bcheckbox__indicator\b/i.test(k.codeClassName ?? "") ||
          /\bindicator\b/i.test(k.codeClassName ?? "") ||
          isBridgeBadgeIconNode(k)),
    );
    const hasLabel = kids.some((k) => k.type === "text" && (k.content ?? "").trim());
    if (hasLabel && !hasIndicator) {
      issues.push({
        rule: "checkbox-indicator",
        severity: "error",
        message: `Checkbox row has label text but no indicator layer (${id}).`,
        nodeId: id,
      });
    }
  }
  return issues;
}

function validateSingleLineTextBounds(nodes: Record<string, EditorNode>): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const content = node.content?.trim();
    if (!content || content.includes("\n")) continue;
    if (/\btextfield__label--float\b/i.test(node.codeClassName ?? "")) continue;
    // Headings/subcopy wrap inside the phone column without explicit newlines.
    if (bridgeTextWrapsAtCapturedWidth(node, content)) continue;
    const lineCap = bridgeCaptureLineCapPx(node);
    if (node.height <= lineCap * 1.35) continue;
    issues.push({
      rule: "single-line-text-height",
      severity: "error",
      message: `Single-line text height ${node.height}px exceeds line cap ${lineCap}px (${id}, "${content.slice(0, 24)}").`,
      nodeId: id,
    });
  }
  return issues;
}

function validateArtboardWidth(
  nodes: Record<string, EditorNode>,
  tolerancePx: number,
  expectPhoneArtboard: boolean,
): BridgeCaptureValidationIssue[] {
  if (!expectPhoneArtboard) return [];
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const node of Object.values(nodes)) {
    if (node.parentId !== null) continue;
    const w = node.width ?? 0;
    if (w < 300) continue;
    if (Math.abs(w - PML_PHONE_COLUMN_WIDTH) > tolerancePx) {
      issues.push({
        rule: "artboard-width",
        severity: "error",
        message: `Screen artboard width ${w}px must be ${PML_PHONE_COLUMN_WIDTH}px.`,
        nodeId: node.id,
      });
    }
  }
  return issues;
}

function validateRoundTripMetadata(
  nodes: Record<string, EditorNode>,
): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  let linkable = 0;
  let linked = 0;
  for (const node of Object.values(nodes)) {
    if (node.type !== "frame" && node.type !== "text") continue;
    if (!node.visible) continue;
    linkable += 1;
    if (node.codeClassName?.trim() || node.codeJsxTag?.trim()) linked += 1;
  }
  if (linkable === 0) return issues;
  const ratio = linked / linkable;
  if (ratio < 0.55) {
    issues.push({
      rule: "round-trip-metadata",
      severity: "error",
      message: `Only ${Math.round(ratio * 100)}% of frame/text layers have codeClassName/codeJsxTag — canvas → code round trip will lose structure.`,
    });
  } else if (ratio < 0.75) {
    issues.push({
      rule: "round-trip-metadata",
      severity: "warning",
      message: `${Math.round(ratio * 100)}% of layers have code linkage; some edits may not round-trip to source.`,
    });
  }
  return issues;
}

function validateSignatureDrawActiveState(
  nodes: Record<string, EditorNode>,
): BridgeCaptureValidationIssue[] {
  const isDrawStep = Object.values(nodes).some(
    (n) => n.type === "text" && /draw your signature/i.test(n.content ?? ""),
  );
  if (!isDrawStep) return [];

  let hasEnabledSave = false;
  let hasDisabledSave = false;
  for (const node of Object.values(nodes)) {
    const cls = node.codeClassName ?? "";
    if (!/\bbtn\b/i.test(cls)) continue;
    const isSave =
      /\bsave\b/i.test(node.name ?? "") ||
      Object.values(nodes).some(
        (n) =>
          n.parentId === node.id &&
          n.type === "text" &&
          /save\s*&\s*continue/i.test(n.content ?? ""),
      );
    if (!isSave) continue;
    if (/\bbtn--disabled\b/i.test(cls)) hasDisabledSave = true;
    if (/\bbtn--filled\b/i.test(cls) && !/\bbtn--disabled\b/i.test(cls)) {
      hasEnabledSave = true;
    }
  }

  if (!hasEnabledSave && hasDisabledSave) {
    return [
      {
        rule: "signature-draw-active-cta",
        severity: "error",
        message:
          "Signature draw screen captured in default state — Save & continue is disabled; push from live after drawing or update preview-menu.",
      },
    ];
  }
  return [];
}

function validateBridgeTextFixedResize(nodes: Record<string, EditorNode>): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    if (/\bbn__label\b/.test(node.codeClassName ?? "")) continue;
    if (/\btextfield__label--float\b/i.test(node.codeClassName ?? "")) continue;
    const mode = node.textResizeMode ?? "auto-width";
    if (mode === "fixed" && node.layoutSizingHorizontal !== "hug") continue;
    issues.push({
      rule: "bridge-text-fixed-resize",
      severity: "error",
      message: `Bridge text must use fixed resize (got ${mode}) for "${(node.content ?? node.name ?? id).slice(0, 32)}".`,
      nodeId: id,
    });
  }
  return issues;
}

function validateBridgeTextVerticalAlign(nodes: Record<string, EditorNode>): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    if (/\bbn__label\b/.test(node.codeClassName ?? "")) continue;
    if (/\btextfield__label--float\b/i.test(node.codeClassName ?? "")) continue;
    if (node.verticalAlign === "top") continue;
    issues.push({
      rule: "bridge-text-vertical-top",
      severity: "error",
      message: `Bridge text must use vertical top align (got ${node.verticalAlign ?? "unset"}) for "${(node.content ?? node.name ?? id).slice(0, 32)}".`,
      nodeId: id,
    });
  }
  return issues;
}

function validateOutlinedControlStrokes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): BridgeCaptureValidationIssue[] {
  const issues: BridgeCaptureValidationIssue[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    const cls = node.codeClassName ?? "";
    if (!/\bbtn--stroke\b/i.test(cls)) continue;
    const hasStroke =
      node.strokeEnabled === true &&
      (node.strokeWidth ?? 0) >= 0.5 &&
      Boolean(node.strokeColor?.trim());
    if (hasStroke) continue;
    issues.push({
      rule: "outlined-button-stroke",
      severity: "error",
      message: `Outline button missing green border stroke (${id}, class=${cls}).`,
      nodeId: id,
    });
  }
  return issues;
}

/** Validate finalized bridge capture fidelity (live → canvas) and round-trip readiness. */
export function validateBridgeCaptureFidelity(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: BridgeCaptureValidationOptions = {},
): BridgeCaptureValidationResult {
  const tolerancePx = opts.tolerancePx ?? BRIDGE_CAPTURE_FIDELITY_TOLERANCE_PX;
  const requireRoundTrip = opts.requireRoundTripMetadata !== false;
  const expectPhoneArtboard = opts.expectPhoneArtboard !== false;

  const errors: BridgeCaptureValidationIssue[] = [
    ...(expectPhoneArtboard ? validateAssuranceHeaderBadges(nodes, childOrder, tolerancePx) : []),
    ...(expectPhoneArtboard ? validateChipBadgeLabels(nodes, childOrder) : []),
    ...(expectPhoneArtboard ? validateSelectedCardStrokes(nodes) : []),
    ...(expectPhoneArtboard ? validateOutlinedControlStrokes(nodes, childOrder) : []),
    ...(expectPhoneArtboard ? validateCheckboxIndicators(nodes, childOrder) : []),
    ...validateSingleLineTextBounds(nodes),
    ...validateBridgeTextFixedResize(nodes),
    ...validateBridgeTextVerticalAlign(nodes),
    ...validateArtboardWidth(nodes, tolerancePx, expectPhoneArtboard),
    ...(expectPhoneArtboard ? validateSignatureDrawActiveState(nodes) : []),
  ];

  const warnings: BridgeCaptureValidationIssue[] = [];
  if (requireRoundTrip) {
    for (const issue of validateRoundTripMetadata(nodes)) {
      if (issue.severity === "error") errors.push(issue);
      else warnings.push(issue);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function formatBridgeCaptureValidationFailure(
  result: BridgeCaptureValidationResult,
): string {
  const lines = result.errors.map((e) => `- [${e.rule}] ${e.message}`);
  return `Bridge capture fidelity check failed (${result.errors.length} issue${result.errors.length === 1 ? "" : "s"}):\n${lines.join("\n")}`;
}

/** Throws when strict fidelity checks fail — use before applying capture to canvas. */
export function assertBridgeCaptureFidelity(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: BridgeCaptureValidationOptions = {},
): BridgeCaptureValidationResult {
  const result = validateBridgeCaptureFidelity(nodes, childOrder, opts);
  if (!result.ok && opts.strict !== false) {
    throw new Error(formatBridgeCaptureValidationFailure(result));
  }
  return result;
}

export function countBridgeCaptureRoots(childOrder: Record<string, string[]>): number {
  return childOrder[EDITOR_ROOT_KEY]?.length ?? 0;
}
