import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { textTypoFromModel, textResizePatch } from "@/lib/text/textNodeModel";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import { enforceBridgeViewportArtboard } from "@/lib/craftBridge/bridgeCaptureViewport";
import { organizeBridgeCaptureLayerNames } from "@/lib/craftBridge/organizeBridgeCaptureLayers";
import { applyTightBoundsFromBrowserCapture, bridgeCaptureLineCapPx, bridgeCapturedInkWidth, bridgeTextWrapsAtCapturedWidth } from "@/lib/craftBridge/browserCaptureTextLayout";
import { hugContentHeightForLayout, measureTextPaintHeight } from "@/lib/text/textBaseline";
import { prepareTextForDisplay, textAdvancedStyleFromNode } from "@/lib/text/textAdvancedStyle";
import { layoutText } from "@/lib/text/textMeasure";
import { MIN_TEXT_BOX, textInnerWidth } from "@/lib/text/textNodeModel";
import { resolveTextTypo } from "@/lib/textTypography";
import { measureStringWidthForTypo } from "@/lib/text/textMeasure";
import type { ResolvedTextTypo } from "@/lib/textTypography";
import { enforceManualScreenFrames } from "@/lib/webImport/enforceManualScreenFrames";
import {
  collapsePassThroughWrappers,
  normalizeWebImportSvgPaths,
  stripWebImportAutoLayout,
} from "@/lib/webImport/normalizeWebImportLayers";
import { parseColor } from "@/lib/webImport/cssParseUtils";
import { ensureReadableTextColor } from "@/lib/webImport/colorContrast";
import { resolveLineHeightPxFromNode } from "@/lib/text/lineHeight";
import { fixImportedTextLineHeightUnit } from "@/lib/webImport/importTextTypography";
import { freezeBridgeCaptureSubtree } from "@/lib/craftBridge/bridgeCaptureLayout";
import { isBridgeTextInsideTextfield } from "@/lib/craftBridge/bridgeTextfieldTextLayout";
import { mergeStrokeIntoNode } from "@/lib/strokeSpec";
import {
  hasPmlButtonClassToken,
  hasPmlStrokeButtonClassToken,
  isPmlIconButtonClassName,
} from "@/lib/webImport/pmlButtonClass";
import {
  isBridgeTextfieldFocusStroke,
  resolveBridgeProjectCssVariable,
  resolveBridgeTextfieldBorderStrokeColor,
} from "@/lib/craftBridge/bridgeCaptureProjectTokens";
import type { CssThemeScope } from "@/lib/codeRoundTrip/parseCssCustomProperties";
import {
  clampPhoneShellFrameWidths,
  clampPhoneTopChromeWidths,
  isPhoneShellClassName,
  isPhoneShellScrollClassName,
} from "@/lib/webImport/phoneShellViewport";

function isBottomNavContainer(n: EditorNode): boolean {
  const tokens = (n.codeClassName ?? "").trim().split(/\s+/).filter(Boolean);
  return tokens.some((t) => t === "bn" || t === "bn__bar" || t === "bn__tabs");
}

const BOTTOM_NAV_LABEL_RE = /\bbn__label\b/;
const LIST_ITEM_TEXT_CLASS_RE = /\b(?:li-item__primary|li-item__secondary)\b/;
const CONSENT_TEXT_CLASS_RE = /\bob-flow-form__tc(?!-text)\b|\bcheckbox__label\b/;
const LIST_ITEM_ROW_CLASS_RE = /\bli-item\b/;

/** Single-line text with CSS line-height padding — clamp to one line box. */
function isSingleLineBridgeText(node: EditorNode): boolean {
  const content = node.content?.trim();
  if (!content || content.includes("\n")) return false;
  if (node.browserTextLayout?.lines && node.browserTextLayout.lines.length > 1) return false;
  return true;
}

function inputHostFrame(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode | undefined {
  let cur: EditorNode | undefined = node.parentId ? nodes[node.parentId] : undefined;
  for (let depth = 0; cur && depth < 8; depth++) {
    const cls = cur.codeClassName ?? "";
    const tag = cur.codeJsxTag ?? "";
    if (
      tag === "input" ||
      /\binput\b|textfield|textarea/i.test(cls) ||
      /^(Input|TextField)$/i.test(cur.name ?? "")
    ) {
      return cur;
    }
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return undefined;
}

function buttonHostFrame(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode | undefined {
  let cur: EditorNode | undefined = node.parentId ? nodes[node.parentId] : undefined;
  for (let depth = 0; cur && depth < 6; depth++) {
    const cls = cur.codeClassName ?? "";
    const tag = cur.codeJsxTag ?? "";
    if (tag === "button" || /\bbtn\b|button/i.test(cls)) return cur;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return undefined;
}

/** Force any remaining single-line boxes down to one CSS line (input placeholders, headings). */
export function fitBridgeSingleLineTextFrames(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text" || !isSingleLineBridgeText(node)) continue;
    const lineCap = bridgeCaptureLineCapPx(node);
    if ((node.height ?? 0) <= lineCap * 1.05) continue;

    const fixed = {
      height: lineCap,
      verticalAlign: "middle" as const,
      layoutSizingVertical: "fixed" as const,
      ...textResizePatch("fixed"),
    };

    if (TEXTFIELD_FLOAT_LABEL_RE.test(node.codeClassName ?? "")) continue;

    const host = inputHostFrame(node, nodes) ?? buttonHostFrame(node, nodes);
    if (host && host.height > lineCap + 2) {
      if (/\btextfield__box\b/i.test(host.codeClassName ?? "")) continue;
      nodes[id] = {
        ...node,
        ...fixed,
        y: Math.max(0, Math.round((host.height - lineCap) / 2)),
      };
      continue;
    }

    nodes[id] = { ...node, ...fixed };
  }
}

const FOOTER_STACK_CLASS_RE =
  /\bob-flow(?:__footer|-form)|footer-zone|pml-signup__footer/i;
const CONSENT_COPY_RE = /\bI agree\b|Privacy Policy|T&Cs/i;
const PRIMARY_BUTTON_COPY_RE = /\bVerify via OTP\b|\bContinue\b|\bSubmit\b/i;

function subtreeText(nodeId: string, nodes: Record<string, EditorNode>, childOrder: Record<string, string[]>): string {
  const n = nodes[nodeId];
  if (!n) return "";
  if (n.type === "text") return n.content ?? "";
  return (childOrder[nodeId] ?? [])
    .map((kid) => subtreeText(kid, nodes, childOrder))
    .filter(Boolean)
    .join(" ");
}

function isPrimaryButtonNode(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const cls = node.codeClassName ?? "";
  if (/\bbtn\b|button/i.test(cls)) return true;
  const copy = node.type === "text" ? node.content ?? "" : subtreeText(node.id, nodes, childOrder);
  return PRIMARY_BUTTON_COPY_RE.test(copy);
}

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

function bridgeTextTypo(node: EditorNode): ResolvedTextTypo {
  return textTypoFromModel({
    fontFamily: node.fontFamily ?? "Inter",
    fontSize: node.fontSize ?? 12,
    fontWeight: node.fontWeight ?? 400,
    lineHeight: node.lineHeight,
    lineHeightUnit: node.lineHeightUnit,
    lineHeightPx: node.lineHeightPx,
    letterSpacing: node.letterSpacing ?? 0,
    color: node.textColor ?? node.fill ?? "#111111",
  });
}

function measuredTextWidth(node: EditorNode, content = node.content ?? ""): number {
  if (!content) return 8;
  return Math.max(8, Math.ceil(measureStringWidthForTypo(content, bridgeTextTypo(node))) + 1);
}

/** Prefer captured DOM width; only remeasure when the box is missing or too narrow. */
function bridgeLayoutLabelWidth(label: EditorNode, content = label.content ?? ""): number {
  const domW = Math.ceil(label.width ?? 0);
  if (label.browserTextLayout?.lines?.length) {
    return Math.max(domW, bridgeCapturedInkWidth(label));
  }
  if (domW >= 8) return domW;
  return measuredTextWidth(label, content);
}

/** Prefer Chromium line ink width when packing inline consent fragments. */
function consentFragmentWidth(node: EditorNode, content = node.content ?? ""): number {
  const capture = node.browserTextLayout;
  if (capture?.lines?.length) {
    let maxRight = 0;
    for (const line of capture.lines) {
      maxRight = Math.max(maxRight, line.x + line.width);
    }
    if (maxRight >= 4) return Math.ceil(maxRight);
  }
  return measuredTextWidth(node, content);
}

function findTcRowFrame(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode | undefined {
  let cur: EditorNode | undefined = node;
  while (cur) {
    if (/\bob-flow-form__tc(?!-text)\b/.test(cur.codeClassName ?? "")) return cur;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return undefined;
}

const KEEP_MEDIUM_WEIGHT_CLASS_RE =
  /\b(?:sh__title|heading|title|hero|btn__label|\bbtn\b)/i;

/** Body copy often captures as 500 (Medium) — Craft renders that heavier than Chromium. */
export function normalizeBridgeCaptureFontWeights(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const w = node.fontWeight ?? 400;
    if (w < 500) continue;
    const cls = node.codeClassName ?? "";
    if (KEEP_MEDIUM_WEIGHT_CLASS_RE.test(cls)) continue;
    nodes[id] = { ...node, fontWeight: 400 };
  }
}

const BRIDGE_LINK_BLUE = "#0066CC";
const BRIDGE_CONSENT_GRAY = "#575757";
const BRIDGE_LINK_LABEL_RE = /^(?:T&Cs|T&C|Privacy Policy|Read more)$/i;

type ConsentInlineRun =
  | { kind: "text"; id: string; node: EditorNode; sortX: number }
  | {
      kind: "link";
      frameId: string;
      labelId: string;
      frame: EditorNode;
      label: EditorNode;
      sortX: number;
    };

const CONSENT_RUN_GAP_PX = 2;

function consentInlineRuns(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): ConsentInlineRun[] {
  const runs: ConsentInlineRun[] = [];
  for (const kidId of childOrder[parentId] ?? []) {
    const kid = nodes[kidId];
    if (!kid || kid.visible === false) continue;
    if (/\bcheckbox__indicator\b/.test(kid.codeClassName ?? "")) continue;
    if (kid.type === "text" && (kid.content ?? "").trim()) {
      runs.push({ kind: "text", id: kidId, node: kid, sortX: kid.x });
      continue;
    }
    if (kid.type === "frame") {
      const labelKids = (childOrder[kidId] ?? []).filter((id) => nodes[id]?.type === "text");
      const labelId = labelKids[0];
      const label = labelId ? nodes[labelId] : undefined;
      if (label?.content?.trim() && labelKids.length === 1) {
        const isLink =
          /\bob-flow-form__link\b/.test(kid.codeClassName ?? "") ||
          BRIDGE_LINK_LABEL_RE.test(label.content.trim());
        if (isLink) {
          runs.push({
            kind: "link",
            frameId: kidId,
            labelId,
            frame: kid,
            label,
            sortX: kid.x + label.x,
          });
        } else {
          runs.push({ kind: "text", id: labelId, node: label, sortX: kid.x + label.x });
        }
      }
    }
  }
  return runs.sort((a, b) => {
    const dx = a.sortX - b.sortX;
    if (Math.abs(dx) > 2) return dx;
    const orderKey = (r: ConsentInlineRun) => {
      const t = (r.kind === "link" ? r.label.content : r.node.content ?? "").trim();
      if (/^I agree/i.test(t)) return 0;
      if (/^T&Cs/i.test(t)) return 1;
      if (t === "&") return 2;
      if (/^Privacy Policy/i.test(t)) return 3;
      return 4;
    };
    return orderKey(a) - orderKey(b);
  });
}

function findConsentCheckboxId(
  rowId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | undefined {
  return (childOrder[rowId] ?? []).find((id) => /\bcheckbox\b/.test(nodes[id]?.codeClassName ?? ""));
}

function reflowOneConsentRow(
  targetId: string,
  rowId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const target = nodes[targetId];
  const row = nodes[rowId];
  if (!target || !row) return;

  const runs = consentInlineRuns(targetId, nodes, childOrder);
  if (runs.length < 2) return;

  const checkboxId = findConsentCheckboxId(rowId, nodes, childOrder);
  const checkbox = checkboxId ? nodes[checkboxId] : undefined;

  const lineCap = Math.max(
    bridgeCaptureLineCapPx(runs[0]!.kind === "link" ? runs[0]!.label : runs[0]!.node),
    ...runs.map((r) => bridgeCaptureLineCapPx(r.kind === "link" ? r.label : r.node)),
  );
  const sharedY = Math.max(0, Math.round((target.height - lineCap) / 2));

  let x: number;
  if (checkbox) {
    const cbY = Math.max(0, Math.round((row.height - checkbox.height) / 2));
    nodes[checkboxId!] = { ...checkbox, y: cbY };
    const firstX = runs[0]!.sortX;
    const gap = Math.max(4, Math.round(firstX - (checkbox.x + checkbox.width)));
    x = checkbox.x + checkbox.width + gap;
  } else {
    x = runs[0]!.sortX;
  }

  for (const run of runs) {
    const textNode = run.kind === "link" ? run.label : run.node;
    const content = textNode.content ?? "";
    const width = consentFragmentWidth(textNode, content);
    const patch = {
      y: sharedY,
      height: lineCap,
      width,
      verticalAlign: "middle" as const,
      layoutSizingVertical: "fixed" as const,
      browserTextLayout: undefined,
      ...textResizePatch("fixed"),
    };

    if (run.kind === "link") {
      nodes[run.labelId] = {
        ...run.label,
        ...patch,
        x,
        y: sharedY,
        parentId: targetId,
        fill: BRIDGE_LINK_BLUE,
        textColor: BRIDGE_LINK_BLUE,
        codeClassName: run.label.codeClassName ?? "ob-flow-form__link",
        textDecoration: "underline",
      };
      delete nodes[run.frameId];
      childOrder[targetId] = (childOrder[targetId] ?? []).filter((id) => id !== run.frameId);
      if (!childOrder[targetId]!.includes(run.labelId)) {
        childOrder[targetId]!.push(run.labelId);
      }
      childOrder[run.frameId] = [];
    } else {
      nodes[run.id] = { ...run.node, ...patch, x };
    }
    x += width + CONSENT_RUN_GAP_PX;
  }
}

/** Shared baseline + Craft-measured x packing for checkbox consent rows. */
export function reflowBridgeConsentTcRow(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const processed = new Set<string>();

  for (const [frameId, frame] of Object.entries(nodes)) {
    if (!frame || frame.type !== "frame") continue;
    const cls = frame.codeClassName ?? "";

    let targetId: string;
    let rowId: string;

    if (/\bob-flow-form__tc-text\b/.test(cls)) {
      targetId = frameId;
      rowId = frame.parentId ?? frameId;
    } else if (/\bob-flow-form__tc(?!-text)\b/.test(cls)) {
      const hasTcText = (childOrder[frameId] ?? []).some((id) =>
        /\bob-flow-form__tc-text\b/.test(nodes[id]?.codeClassName ?? ""),
      );
      if (hasTcText) continue;
      targetId = frameId;
      rowId = frameId;
    } else {
      continue;
    }

    if (processed.has(targetId)) continue;
    processed.add(targetId);
    reflowOneConsentRow(targetId, rowId, nodes, childOrder);
  }
}

/** Keep consent copy above the primary button when captured line boxes overlap. */
export function separateBridgeFooterConsentFromButton(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent) continue;
    const pCls = parent.codeClassName ?? "";
    if (!FOOTER_STACK_CLASS_RE.test(pCls) && !/\bob-flow-form\b/.test(pCls)) continue;

    let tcRow: EditorNode | undefined;
    let button: EditorNode | undefined;

    for (const kidId of kids) {
      const kid = nodes[kidId];
      if (!kid || kid.visible === false) continue;
      if (/\bob-flow-form__tc(?!-text)\b/.test(kid.codeClassName ?? "")) tcRow = kid;
      if (isPrimaryButtonNode(kid, nodes, childOrder)) button = kid;
    }
    if (!tcRow || !button) continue;

    const rowNode = tcRow;
    const gap = 12;
    const rowAbs = absoluteOffset(rowNode.id, nodes);
    const buttonAbs = absoluteOffset(button.id, nodes);
    const rowH = rowNode.height ?? bridgeCaptureLineCapPx(rowNode);
    const rowBottom = rowAbs.y + rowH;
    if (rowBottom + gap <= buttonAbs.y) continue;

    const targetAbsY = buttonAbs.y - gap - rowH;
    const parentAbs = rowNode.parentId ? absoluteOffset(rowNode.parentId, nodes) : { x: 0, y: 0 };
    nodes[rowNode.id] = {
      ...rowNode,
      y: Math.max(0, Math.round(targetAbsY - parentAbs.y)),
    };
  }
}

const BADGE_ROW_CLASS_RE = /\bbadge\b|__assurance|header__assurance/i;
const CHIP_LABEL_MAX_LEN = 24;
const ASSURANCE_HEADER_COPY_RE = /required by sebi/i;
const FOOTER_ASSURANCE_COPY_RE = /your data is 100% safe/i;

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

function isBridgeAssuranceHeaderLabel(node: EditorNode): boolean {
  return ASSURANCE_HEADER_COPY_RE.test(node.content?.trim() ?? "");
}

function reparentIntoBadgeHost(
  childId: string,
  hostId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const child = nodes[childId];
  if (!child || child.parentId === hostId) return;
  const oldParentId = child.parentId;
  if (!oldParentId) return;

  const childAbs = absoluteOffset(childId, nodes);
  const hostAbs = absoluteOffset(hostId, nodes);
  nodes[childId] = {
    ...child,
    parentId: hostId,
    x: childAbs.x - hostAbs.x,
    y: childAbs.y - hostAbs.y,
  };
  childOrder[oldParentId] = (childOrder[oldParentId] ?? []).filter((id) => id !== childId);
  childOrder[hostId] = [...(childOrder[hostId] ?? []).filter((id) => id !== childId), childId];
}

function findBridgeBadgeIconNearLabel(
  label: EditorNode,
  searchRootId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  excludeIds: Set<string> = new Set(),
): EditorNode | undefined {
  const labelAbs = absoluteOffset(label.id, nodes);
  let best: EditorNode | undefined;
  let bestScore = Infinity;

  const visit = (parentId: string): void => {
    for (const kidId of childOrder[parentId] ?? []) {
      if (excludeIds.has(kidId) || kidId === label.id) continue;
      const kid = nodes[kidId];
      if (!kid || kid.visible === false) continue;
      if (isBridgeBadgeIconNode(kid)) {
        const kidAbs = absoluteOffset(kidId, nodes);
        if (kidAbs.x >= labelAbs.x) continue;
        const gap = labelAbs.x - (kidAbs.x + kid.width);
        if (gap > 20) continue;
        const labelCy = labelAbs.y + label.height / 2;
        const iconCy = kidAbs.y + kid.height / 2;
        const score = Math.abs(iconCy - labelCy) * 10 + Math.max(0, gap);
        if (score < bestScore) {
          bestScore = score;
          best = kid;
        }
      }
      if (kid.type === "frame" || kid.type === "group") visit(kidId);
    }
  };

  visit(searchRootId);
  return best;
}

function isChipLabelText(node: EditorNode): boolean {
  const content = (node.content ?? "").trim();
  if (!content || content.length > CHIP_LABEL_MAX_LEN || content.includes("\n")) return false;
  return (node.fontSize ?? 14) <= 13 || content.split(/\s+/).length <= 4;
}

function frameHasVisibleTextChild(
  frameId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  return visibleChildren(nodes, childOrder, frameId).some(
    (n) => n.type === "text" && (n.content ?? "").trim(),
  );
}

function isEmptyBridgeChipFrame(
  frame: EditorNode | undefined,
  frameId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  if (!frame || frame.type !== "frame") return false;
  if (!isBridgeBadgePillFrame(frame)) return false;
  return !frameHasVisibleTextChild(frameId, nodes, childOrder);
}

function orphanChipLabelNearPill(
  text: EditorNode,
  pill: EditorNode,
  pillAbs: { x: number; y: number },
  textAbs: { x: number; y: number },
): boolean {
  if (!isChipLabelText(text)) return false;
  const textH = text.height ?? 16;
  const pillH = pill.height ?? 20;
  const vOverlap =
    textAbs.y + textH >= pillAbs.y - 3 && textAbs.y <= pillAbs.y + pillH + 3;
  const nearX =
    textAbs.x >= pillAbs.x - 6 && textAbs.x <= pillAbs.x + (pill.width ?? 0) + 28;
  return vOverlap && nearX;
}

/** Reparent chip copy sitting beside an empty pill frame (common flex-row badge split). */
export function recoverBridgeOrphanChipLabels(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const pillIds = kids.filter((id) => isEmptyBridgeChipFrame(nodes[id], id, nodes, childOrder));
    if (pillIds.length === 0) continue;

    const claimed = new Set<string>();
    for (const pillId of pillIds) {
      const pill = nodes[pillId];
      if (!pill) continue;
      const pillAbs = absoluteOffset(pillId, nodes);

      let best: EditorNode | undefined;
      let bestDist = Infinity;
      for (const kidId of kids) {
        if (claimed.has(kidId) || kidId === pillId) continue;
        const text = nodes[kidId];
        if (!text || text.type !== "text") continue;
        const textAbs = absoluteOffset(kidId, nodes);
        if (!orphanChipLabelNearPill(text, pill, pillAbs, textAbs)) continue;
        const dist = Math.abs(textAbs.x - pillAbs.x) + Math.abs(textAbs.y - pillAbs.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = text;
        }
      }
      if (!best) continue;

      claimed.add(best.id);
      const textAbs = absoluteOffset(best.id, nodes);
      nodes[best.id] = {
        ...best,
        parentId: pillId,
        x: textAbs.x - pillAbs.x,
        y: textAbs.y - pillAbs.y,
        codeClassName: best.codeClassName ?? pill.codeClassName,
      };
      childOrder[parentId] = (childOrder[parentId] ?? []).filter((id) => id !== best!.id);
      childOrder[pillId] = [...(childOrder[pillId] ?? []), best.id];
    }
  }
}

function badgeIconNodes(visible: EditorNode[]): EditorNode[] {
  const icons = visible.filter((n) => isBridgeBadgeIconNode(n));
  return icons.sort((a, b) => {
    const aWrap = /\bbadge__icon\b/i.test(a.codeClassName ?? "") ? 0 : 1;
    const bWrap = /\bbadge__icon\b/i.test(b.codeClassName ?? "") ? 0 : 1;
    return aWrap - bWrap;
  });
}

function badgeRowLabel(
  frameId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): { label: EditorNode; icon?: EditorNode } | null {
  const visible = visibleChildren(nodes, childOrder, frameId);
  let labels = visible.filter((n) => n.type === "text" && (n.content ?? "").trim());
  let icon = badgeIconNodes(visible)[0];

  if (labels.length === 0) {
    for (const kid of visible) {
      if (kid.type !== "frame" || !/\bbadge__icon\b|__icon\b/i.test(kid.codeClassName ?? "")) {
        continue;
      }
      const nested = visibleChildren(nodes, childOrder, kid.id);
      labels = nested.filter((n) => n.type === "text" && (n.content ?? "").trim());
      if (labels.length === 0) continue;
      icon = kid;
      const label = labels[0]!;
      const hoisted = {
        ...label,
        x: kid.x + label.x,
        y: kid.y + label.y,
        parentId: frameId,
      };
      nodes[label.id] = hoisted;
      const frameKids = childOrder[frameId] ?? [];
      if (!frameKids.includes(label.id)) {
        childOrder[frameId] = [...frameKids, label.id];
      }
      childOrder[kid.id] = (childOrder[kid.id] ?? []).filter((id) => id !== label.id);
      return { label: hoisted, icon: kid };
    }
    return null;
  }

  return { label: labels[0]!, icon };
}

/** Pull split icon/label siblings into the pill host before row layout. */
export function recoverBridgeBadgeRowParts(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [hostId] of Object.entries(childOrder)) {
    const host = nodes[hostId];
    if (!host || host.type !== "frame" || !isBridgeBadgePillFrame(host)) continue;

    const hostAbs = absoluteOffset(hostId, nodes);
    const parentId = host.parentId;
    if (!parentId) continue;

    if (!frameHasVisibleTextChild(hostId, nodes, childOrder)) {
      for (const kidId of childOrder[parentId] ?? []) {
        if (kidId === hostId) continue;
        const kid = nodes[kidId];
        if (!kid || kid.type !== "text") continue;
        const content = kid.content?.trim() ?? "";
        if (!content) continue;
        if (!ASSURANCE_HEADER_COPY_RE.test(content) && content.length > CHIP_LABEL_MAX_LEN) continue;
        const kidAbs = absoluteOffset(kidId, nodes);
        const nearPill =
          kidAbs.x >= hostAbs.x - 8 &&
          kidAbs.x <= hostAbs.x + host.width + 24 &&
          kidAbs.y + kid.height >= hostAbs.y - 6 &&
          kidAbs.y <= hostAbs.y + host.height + 6;
        if (!nearPill) continue;
        reparentIntoBadgeHost(kidId, hostId, nodes, childOrder);
        break;
      }
    }

    if (badgeIconNodes(visibleChildren(nodes, childOrder, hostId)).length === 0) {
      const labelInHost =
        visibleChildren(nodes, childOrder, hostId).find((n) => n.type === "text" && n.content?.trim()) ??
        [...Object.values(nodes)].find(
          (n) =>
            n.type === "text" &&
            n.parentId === parentId &&
            (ASSURANCE_HEADER_COPY_RE.test(n.content ?? "") ||
              absoluteOffset(n.id, nodes).x >= hostAbs.x - 8),
        );
      if (labelInHost) {
        const icon = findBridgeBadgeIconNearLabel(
          labelInHost,
          parentId,
          nodes,
          childOrder,
          new Set([hostId]),
        );
        if (icon) reparentIntoBadgeHost(icon.id, hostId, nodes, childOrder);
      }
    }
  }
}

function bridgeInlineRowLabelHeight(label: EditorNode): number {
  const lineCap = bridgeCaptureLineCapPx(label);
  const content = label.content ?? "";
  if (!content || content.includes("\n")) {
    return Math.max(lineCap, bridgeCaptureInkHeight(label, content));
  }
  return lineCap;
}

function layoutBridgeIconLabelInHost(
  hostId: string,
  label: EditorNode,
  icon: EditorNode | undefined,
  nodes: Record<string, EditorNode>,
): void {
  const host = nodes[hostId];
  if (!host) return;

  const lineCap = bridgeCaptureLineCapPx(label);
  const labelWidth = bridgeLayoutLabelWidth(label);
  const rowCenterY = host.height / 2;

  let gap = 6;
  if (icon && label.x >= icon.x + icon.width - 1) {
    gap = Math.max(4, Math.round(label.x - (icon.x + icon.width)));
  }

  const padX = icon ? Math.max(8, icon.x) : 8;
  const iconX = padX;
  const iconY = icon ? Math.round(rowCenterY - icon.height / 2) : 0;
  if (icon) {
    nodes[icon.id] = { ...icon, x: iconX, y: Math.max(0, iconY) };
  }

  let labelX = icon ? iconX + icon.width + gap : padX;
  const labelHeight = bridgeInlineRowLabelHeight(label);
  const labelY = Math.max(0, Math.round(rowCenterY - labelHeight / 2));
  const contentW = (icon ? icon.width + gap : 0) + labelWidth;
  const groupStart = icon ? iconX : labelX;

  if (!icon) {
    labelX = Math.max(0, Math.round((host.width - labelWidth) / 2));
  }

  const leftPad = icon ? groupStart : labelX;
  const rightPad = host.width - (labelX + labelWidth);
  if (Math.abs(leftPad - rightPad) <= 3) {
    const shift = Math.round((host.width - contentW) / 2) - groupStart;
    labelX += shift;
    if (icon) nodes[icon.id] = { ...nodes[icon.id]!, x: iconX + shift };
  }

  nodes[label.id] = {
    ...label,
    x: labelX,
    y: labelY,
    width: labelWidth,
    height: labelHeight,
    textAlign: "left",
    verticalAlign: "top",
    bridgeDomTextBox: true,
    layoutSizingVertical: "fixed",
    ...textResizePatch("fixed"),
  };

  const trailingPad = Math.max(8, leftPad);
  const needW = Math.ceil(labelX + labelWidth + trailingPad);
  if (needW > host.width) {
    nodes[hostId] = { ...host, width: needW };
  }
}

function findBridgeBadgePillNearLabel(
  label: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): EditorNode | undefined {
  const host = bridgeBadgeHostFrame(label, nodes);
  if (host && isBridgeBadgePillFrame(host)) return host;
  const parentId = label.parentId;
  if (parentId) {
    for (const kidId of childOrder[parentId] ?? []) {
      const kid = nodes[kidId];
      if (kid && isBridgeBadgePillFrame(kid)) return kid;
    }
    const parent = nodes[parentId];
    if (parent && isBridgeBadgePillFrame(parent)) return parent;
  }
  return host;
}

function alignBridgeIconLabelInRow(
  rowId: string,
  label: EditorNode,
  icon: EditorNode | undefined,
  nodes: Record<string, EditorNode>,
): void {
  const row = nodes[rowId];
  if (!row) return;
  const lineCap = bridgeCaptureLineCapPx(label);
  const labelWidth = bridgeLayoutLabelWidth(label);
  const rowCenterY = row.height / 2;
  let gap = 6;
  if (icon && label.x >= icon.x + icon.width - 1) {
    gap = Math.max(4, Math.round(label.x - (icon.x + icon.width)));
  }
  const iconY = icon ? Math.max(0, Math.round(rowCenterY - icon.height / 2)) : 0;
  if (icon) nodes[icon.id] = { ...icon, y: iconY };
  const labelHeight = bridgeInlineRowLabelHeight(label);
  const labelY = Math.max(0, Math.round(rowCenterY - labelHeight / 2));
  let labelX = icon ? icon.x + icon.width + gap : label.x;
  nodes[label.id] = {
    ...label,
    x: labelX,
    y: labelY,
    width: labelWidth,
    height: labelHeight,
    textAlign: "left",
    verticalAlign: "top",
    bridgeDomTextBox: true,
    layoutSizingVertical: "fixed",
    ...textResizePatch("fixed"),
  };
}

/** Content-driven pass for the header assurance badge when DOM capture splits icon + label. */
export function alignBridgeAssuranceHeaderBadges(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const node of Object.values(nodes)) {
    if (node.type !== "text" || !isBridgeAssuranceHeaderLabel(node)) continue;

    const host = findBridgeBadgePillNearLabel(node, nodes, childOrder);
    if (host && isBridgeBadgePillFrame(host)) {
      let icon = badgeIconNodes(visibleChildren(nodes, childOrder, host.id))[0];
      if (!icon && host.parentId) {
        icon = findBridgeBadgeIconNearLabel(node, host.parentId, nodes, childOrder, new Set([host.id]));
        if (icon) reparentIntoBadgeHost(icon.id, host.id, nodes, childOrder);
      }
      if (node.parentId !== host.id) {
        reparentIntoBadgeHost(node.id, host.id, nodes, childOrder);
      }
      layoutBridgeIconLabelInHost(host.id, nodes[node.id]!, icon, nodes);
      continue;
    }

    const rowId = node.parentId;
    if (!rowId) continue;
    let icon = findBridgeBadgeIconNearLabel(node, rowId, nodes, childOrder);
    if (icon) alignBridgeIconLabelInRow(rowId, node, icon, nodes);
  }
}

/** Icon + label share one vertical center inside the pill; width hugs measured label. */
export function layoutBridgeBadgeRows(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [frameId] of Object.entries(childOrder)) {
    const frame = nodes[frameId];
    if (!frame || frame.type !== "frame") continue;
    if (!isBridgeBadgePillFrame(frame)) continue;

    const parts = badgeRowLabel(frameId, nodes, childOrder);
    if (!parts) continue;
    layoutBridgeIconLabelInHost(frameId, parts.label, parts.icon, nodes);
  }
}

/** @deprecated Use layoutBridgeBadgeRows */
export const syncBridgeBadgeRowLabels = layoutBridgeBadgeRows;

function clampBridgeInflatedSingleLineText(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgePositiveCalloutText(node, nodes)) continue;
    const content = node.content?.trim();
    if (!content || content.includes("\n")) continue;
    const minH = bridgeCaptureInkHeight(node, content);
    if (node.height <= minH * 1.2) continue;
    nodes[id] = {
      ...node,
      height: minH,
      bridgeDomTextBox: true,
      verticalAlign: "top",
      layoutSizingVertical: "fixed",
      ...textResizePatch("fixed"),
    };
  }
}

/** Fix ultra-narrow captured text (causes vertical letter stacks). */
function fixBridgeAbsurdTextWidths(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const content = node.content?.trim();
    if (!content || content.length < 2) continue;
    const fontSize = node.fontSize ?? 14;
    const minW = Math.min(
      Math.ceil(content.length * fontSize * 0.55) + 4,
      320,
    );
    if ((node.width ?? 0) >= minW * 0.45) continue;
    nodes[id] = {
      ...node,
      width: Math.max(node.width, minW),
      ...textResizePatch("fixed"),
    };
  }
}

/** Shrink text layers to browser line ink bounds; lock all frames to captured height. */
export function tightenBridgeCaptureTextBounds(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (node.browserTextLayout?.lines?.length) {
      nodes[id] = applyTightBoundsFromBrowserCapture(node);
    }
  }
  clampBridgeInflatedSingleLineText(nodes);
  fixBridgeAbsurdTextWidths(nodes);
}

/** Lock captured text to DOM bounds — textfields use auto-width so typing is not clipped. */
export function preserveBridgeCaptureTextGeometry(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const insideTextfield = isBridgeTextInsideTextfield(node, nodes);
    const floatLabel = /\btextfield__label--float\b/.test(node.codeClassName ?? "");
    const resizePatch = insideTextfield ? textResizePatch("auto-width") : textResizePatch("fixed");
    nodes[id] = {
      ...node,
      layoutPositioning: "absolute",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "fixed",
      layoutDirty: false,
      verticalAlign: "top",
      bridgeDomTextBox: insideTextfield || floatLabel ? node.bridgeDomTextBox : true,
      ...resizePatch,
    };
  }
}

/** Final pass: every non-textfield bridge text layer must stay fixed resize (1:1 DOM box). */
export function enforceBridgeCaptureTextFixedResize(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    if (/\bbn__label\b/.test(node.codeClassName ?? "")) continue;
    if (node.textResizeMode === "fixed" && node.layoutSizingHorizontal === "fixed") continue;
    nodes[id] = {
      ...node,
      layoutPositioning: node.layoutPositioning ?? "absolute",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "fixed",
      layoutDirty: false,
      ...textResizePatch("fixed"),
    };
  }
}

/** Expand list rows when captured text extends below the row — keep Playwright x/y/width. */
function ensureBridgeListItemRowBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const n of Object.values(nodes)) {
    if (!LIST_ITEM_TEXT_CLASS_RE.test(n.codeClassName ?? "")) continue;
    if (n.type !== "text" || !n.content?.trim()) continue;
    const row = findListItemRowRoot(n, nodes);
    if (!row) continue;
    const bottom = n.y + n.height;
    if (bottom + 12 > row.height) {
      nodes[row.id] = { ...row, height: Math.ceil(bottom + 12) };
    }
  }
}

function findListItemRowRoot(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode | undefined {
  let cur: EditorNode | undefined = node;
  while (cur) {
    if (cur.codeJsxTag === "ListItem") return cur;
    const cls = cur.codeClassName ?? "";
    if (/\bli-item\b/.test(cls) && !LIST_ITEM_TEXT_CLASS_RE.test(cls)) return cur;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return undefined;
}

/** Expand bottom nav labels without recentering — keep Playwright x/y. */
function expandBridgeBottomNavLabels(nodes: Record<string, EditorNode>): void {
  for (const [id, n] of Object.entries(nodes)) {
    if (n.type !== "text") continue;
    if (!BOTTOM_NAV_LABEL_RE.test(n.codeClassName ?? "")) continue;
    const content = n.content?.trim();
    if (!content) continue;
    const fontSize = n.fontSize ?? 12;
    const lineH = capturedLineHeightPx(n);
    const estW = Math.ceil(content.length * fontSize * 0.58) + 4;
    nodes[id] = {
      ...n,
      width: Math.max(n.width, estW, 40),
      height: Math.max(n.height, Math.ceil(lineH)),
      textAlign: n.textAlign ?? "center",
      ...textResizePatch("fixed"),
    };
  }
}

function bridgeLinkFrameAncestor(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode | undefined {
  let cur: EditorNode | undefined = node.parentId ? nodes[node.parentId] : undefined;
  for (let depth = 0; cur && depth < 6; depth++) {
    if (/\bob-flow-form__link\b/.test(cur.codeClassName ?? "")) return cur;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return undefined;
}

function bridgeBadgeHostFrame(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): EditorNode | undefined {
  let cur: EditorNode | undefined = node.parentId ? nodes[node.parentId] : undefined;
  for (let depth = 0; cur && depth < 5; depth++) {
    const cls = cur.codeClassName ?? "";
    if (/\bbadge\b/i.test(cls) || /__assurance\b/i.test(cls)) return cur;
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }
  return undefined;
}

function bridgeCaptureTextColorFallback(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): string {
  const cls = node.codeClassName ?? "";
  const content = node.content?.trim() ?? "";
  if (/\bob-flow-form__link\b/.test(cls) || BRIDGE_LINK_LABEL_RE.test(content)) {
    return BRIDGE_LINK_BLUE;
  }
  if (bridgeLinkFrameAncestor(node, nodes)) return BRIDGE_LINK_BLUE;
  if (/\bhero__zero\b/.test(cls)) return BRIDGE_LINK_BLUE;

  const badgeHost = bridgeBadgeHostFrame(node, nodes);
  if (badgeHost || /\bbadge__/.test(cls) || /\bbadge\b/.test(cls)) {
    const hostCls = badgeHost?.codeClassName ?? cls;
    const bg = parseColor(badgeHost?.fill ?? "");
    if (/\bmuted\b/i.test(hostCls) || /\bbadge--text\b/i.test(hostCls)) {
      return bg ? (ensureReadableTextColor("#575757", bg) ?? "#575757") : "#575757";
    }
    if (bg) return ensureReadableTextColor("#ffffff", bg) ?? "#0369A1";
    return "#0369A1";
  }

  if (/\bob-flow-welcome(?:__|-)(?:brand|logo|tagline|subtitle)\b/.test(cls)) return BRIDGE_CONSENT_GRAY;
  if (/\b(?:text-positive|positive|notice|callout|alert|info|message)\b/i.test(cls)) return "#158939";
  if (/\bbtn__label\b/.test(cls)) return "#FFFFFF";
  if (/\bob-flow-form/.test(cls) || /\bcheckbox/.test(cls)) return BRIDGE_CONSENT_GRAY;
  return "#111111";
}

/** Vertically + horizontally center button labels inside captured btn frames. */
export function centerBridgeButtonLabels(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (!/\bbtn__label\b/.test(node.codeClassName ?? "")) continue;
    const host = buttonHostFrame(node, nodes);
    if (!host) continue;
    const lineCap = bridgeCaptureLineCapPx(node);
    const content = node.content ?? "";
    const width = bridgeLayoutLabelWidth(node, content);
    nodes[id] = {
      ...node,
      x: Math.max(0, Math.round((host.width - width) / 2)),
      y: Math.max(0, Math.round((host.height - lineCap) / 2)),
      width,
      height: lineCap,
      textAlign: "center",
      verticalAlign: "middle",
      layoutSizingVertical: "fixed",
      ...textResizePatch("fixed"),
    };
  }
}

/** Keep textfield borders visible — outline-only fields must not pick up page-gray fills. */
const TEXTFIELD_BOX_CLASS_RE = /\btextfield(?:__box|__input|-input)?\b/i;
const TEXTFIELD_FLOAT_LABEL_RE = /\btextfield__label--float\b/i;
const TEXTFIELD_PLACEHOLDER_RE = /^(mobile number|enter mobile|phone number|email|password)$/i;

export type FinalizeBridgeLiveCaptureOptions = {
  cssSources?: string[];
  theme?: CssThemeScope;
};

function normalizeBridgeTextfieldStrokeColor(
  color: string | undefined,
  cssSources: string[] | undefined,
  theme: CssThemeScope,
): string | undefined {
  return resolveBridgeTextfieldBorderStrokeColor(color, cssSources, theme);
}

function isBridgeTextfieldShell(node: EditorNode): boolean {
  const cls = node.codeClassName ?? "";
  return TEXTFIELD_BOX_CLASS_RE.test(cls) || /\btextfield\b/i.test(cls);
}

function frameLooksLikeTextfieldBox(node: EditorNode): boolean {
  if (node.type !== "frame") return false;
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  if (w < 180 || h < 28 || h > 96) return false;
  if (isBridgeTextfieldShell(node)) return true;
  if (node.name === "Input" && w >= 240) return true;
  if (node.codeJsxTag === "input") return true;
  return false;
}

function innermostTargetIds(targets: Set<string>, nodes: Record<string, EditorNode>): string[] {
  return [...targets].filter((id) => {
    let cur = nodes[id]?.parentId ?? null;
    while (cur) {
      if (targets.has(cur)) return false;
      cur = nodes[cur]?.parentId ?? null;
    }
    return true;
  });
}

function bridgeTextfieldOutlineTargetIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string[] {
  const targets = new Set<string>();

  for (const [id, node] of Object.entries(nodes)) {
    if (frameLooksLikeTextfieldBox(node) && isBridgeTextfieldShell(node)) {
      targets.add(id);
    }
  }

  if (targets.size === 0) {
    for (const [id, node] of Object.entries(nodes)) {
      if (frameLooksLikeTextfieldBox(node)) targets.add(id);
    }
  }

  for (const node of Object.values(nodes)) {
    if (node.type !== "text") continue;
    const content = (node.content ?? "").trim();
    if (!content || content.length > 80) continue;
    if (TEXTFIELD_FLOAT_LABEL_RE.test(node.codeClassName ?? "")) continue;
    if (!TEXTFIELD_PLACEHOLDER_RE.test(content) && content.length > 24) continue;

    let cur: string | null = node.parentId;
    let bestId: string | null = null;
    let bestScore = Infinity;
    while (cur) {
      const frame = nodes[cur];
      if (frame && frameLooksLikeTextfieldBox(frame)) {
        const score = isBridgeTextfieldShell(frame)
          ? (frame.width ?? 0) * (frame.height ?? 0) - 10_000
          : (frame.width ?? 0) * (frame.height ?? 0);
        if (score < bestScore) {
          bestScore = score;
          bestId = cur;
        }
      }
      cur = nodes[cur]?.parentId ?? null;
    }
    if (bestId) targets.add(bestId);
  }

  void childOrder;
  return innermostTargetIds(targets, nodes);
}

type BridgeCornerStyle = Pick<EditorNode, "cornerRadius" | "cornerRadii">;

function hasCapturedCornerStyle(node: EditorNode): boolean {
  if ((node.cornerRadius ?? 0) > 0) return true;
  return (node.cornerRadii ?? []).some((r) => r > 0);
}

function cornerStyleFromNode(node: EditorNode): BridgeCornerStyle {
  const radii = node.cornerRadii;
  if (radii?.length === 4 && radii.some((r) => r > 0)) {
    const [tl, tr, br, bl] = radii;
    if (tl === tr && tr === br && br === bl) return { cornerRadius: tl };
    return { cornerRadii: [...radii] as EditorNode["cornerRadii"] };
  }
  if ((node.cornerRadius ?? 0) > 0) return { cornerRadius: node.cornerRadius };
  return {};
}

/** Prefer captured radius from textfield__box (matches live CSS border-radius). */
export function resolveBridgeTextfieldCornerStyle(
  frameId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): BridgeCornerStyle {
  const walk = (id: string, boxOnly: boolean): BridgeCornerStyle | null => {
    const n = nodes[id];
    if (!n) return null;
    if (boxOnly) {
      if (/\btextfield__box\b/i.test(n.codeClassName ?? "") && hasCapturedCornerStyle(n)) {
        return cornerStyleFromNode(n);
      }
    } else if (hasCapturedCornerStyle(n)) {
      return cornerStyleFromNode(n);
    }
    for (const kid of childOrder[id] ?? []) {
      const hit = walk(kid, boxOnly);
      if (hit) return hit;
    }
    return null;
  };

  const fromBox = walk(frameId, true);
  if (fromBox && Object.keys(fromBox).length > 0) return fromBox;

  const fromDesc = walk(frameId, false);
  if (fromDesc && Object.keys(fromDesc).length > 0) return fromDesc;

  const frame = nodes[frameId];
  if (frame && hasCapturedCornerStyle(frame)) return cornerStyleFromNode(frame);

  let cur = frame?.parentId ?? null;
  while (cur) {
    const n = nodes[cur];
    if (n && isBridgeTextfieldShell(n) && hasCapturedCornerStyle(n)) {
      return cornerStyleFromNode(n);
    }
    cur = n?.parentId ?? null;
  }
  return {};
}

/** Put the visible border on textfield__box when capture kept it as a child frame. */
function resolveBridgeTextfieldBorderHost(
  frameId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const walk = (id: string): string | null => {
    for (const kid of childOrder[id] ?? []) {
      const n = nodes[kid];
      if (n?.type === "frame" && /\btextfield__box\b/i.test(n.codeClassName ?? "")) {
        return kid;
      }
      const deeper = walk(kid);
      if (deeper) return deeper;
    }
    return null;
  };
  return walk(frameId) ?? frameId;
}

function applyBridgeTextfieldOutline(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  id: string,
  node: EditorNode,
  opts: FinalizeBridgeLiveCaptureOptions,
): void {
  const corners = resolveBridgeTextfieldCornerStyle(id, nodes, childOrder);
  const theme = opts.theme ?? "light";
  const strokeColor = normalizeBridgeTextfieldStrokeColor(
    node.strokeColor,
    opts.cssSources,
    theme,
  );
  const strokeWidth =
    (node.strokeWidth ?? 0) >= 0.5 ? node.strokeWidth : strokeColor ? 1 : undefined;

  if (!strokeColor || !strokeWidth) {
    if (Object.keys(corners).length > 0) {
      nodes[id] = { ...node, ...corners, clipChildren: false };
    }
    return;
  }

  const strokePatch = mergeStrokeIntoNode(node, {
    strokeEnabled: true,
    strokeWidth,
    strokeColor,
    strokePosition: "inside",
  });
  nodes[id] = {
    ...node,
    ...strokePatch,
    ...corners,
    fillEnabled: false,
    fill: undefined,
    clipChildren: false,
  };
}

function ensureBridgeTextfieldBorderLayer(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  frameId: string,
  opts: FinalizeBridgeLiveCaptureOptions,
): void {
  const frame = nodes[frameId];
  if (!frame || frame.type !== "frame") return;

  const borderId = `${frameId}__tf-border`;
  const kids = childOrder[frameId] ?? [];
  const existingId =
    kids.find((cid) => cid === borderId || nodes[cid]?.name === "textfield border") ?? null;

  const corners = resolveBridgeTextfieldCornerStyle(frameId, nodes, childOrder);
  const theme = opts.theme ?? "light";
  const strokeColor = normalizeBridgeTextfieldStrokeColor(
    frame.strokeColor,
    opts.cssSources,
    theme,
  );
  if (!strokeColor) return;

  const strokePatch = mergeStrokeIntoNode(frame, {
    strokeEnabled: true,
    strokeWidth: (frame.strokeWidth ?? 0) >= 0.5 ? frame.strokeWidth : 1,
    strokeColor,
    strokePosition: "inside",
  });

  if (existingId) {
    nodes[existingId] = {
      ...nodes[existingId]!,
      width: frame.width,
      height: frame.height,
      ...corners,
      ...strokePatch,
      fillEnabled: false,
      locked: false,
    };
    nodes[frameId] = {
      ...frame,
      ...corners,
      fillEnabled: false,
      fill: undefined,
      clipChildren: false,
    };
    return;
  }

  nodes[borderId] = {
    id: borderId,
    parentId: frameId,
    type: "rectangle",
    name: "textfield border",
    x: 0,
    y: 0,
    width: frame.width,
    height: frame.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: false,
    fillEnabled: false,
    ...corners,
    ...strokePatch,
  };
  childOrder[frameId] = [borderId, ...kids];

  nodes[frameId] = {
    ...frame,
    ...corners,
    fillEnabled: false,
    fill: undefined,
    clipChildren: false,
  };
}

export function ensureBridgeCaptureFrameStrokes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: FinalizeBridgeLiveCaptureOptions = {},
): void {
  for (const frameId of bridgeTextfieldOutlineTargetIds(nodes, childOrder)) {
    const hostId = resolveBridgeTextfieldBorderHost(frameId, nodes, childOrder);
    const node = nodes[hostId];
    if (!node) continue;
    applyBridgeTextfieldOutline(nodes, childOrder, hostId, node, opts);
    const host = nodes[hostId];
    const strokeColor = host?.strokeColor?.trim();
    const hasFrameStroke =
      host?.strokeEnabled === true &&
      (host.strokeWidth ?? 0) >= 0.5 &&
      Boolean(strokeColor) &&
      !isBridgeTextfieldFocusStroke(strokeColor);
    if (hasFrameStroke) {
      nodes[hostId] = { ...host!, clipChildren: false };
      continue;
    }
    ensureBridgeTextfieldBorderLayer(nodes, childOrder, hostId, opts);
  }
}

/** Float label center sits on the top border (CSS top:0 + translateY(-50%)). */
export function alignBridgeTextfieldFloatingLabels(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [boxId, box] of Object.entries(nodes)) {
    if (!/\btextfield__box\b/i.test(box.codeClassName ?? "")) continue;
    nodes[boxId] = { ...box, clipChildren: false };

    for (const kidId of childOrder[boxId] ?? []) {
      const kid = nodes[kidId];
      if (kid?.type !== "text") continue;
      if (!TEXTFIELD_FLOAT_LABEL_RE.test(kid.codeClassName ?? "")) continue;
      const lineH = capturedLineHeightPx(kid);
      nodes[kidId] = {
        ...kid,
        y: -Math.round(lineH / 2),
        verticalAlign: "top",
        layoutPositioning: "absolute",
        layoutSizingVertical: "fixed",
        ...textResizePatch("fixed"),
      };
    }
  }
}

function alignBridgeTextfieldInputValues(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [boxId, box] of Object.entries(nodes)) {
    if (!/\btextfield__box\b/i.test(box.codeClassName ?? "")) continue;
    const boxH = box.height ?? 0;
    if (boxH < 24) continue;

    const walk = (parentId: string): void => {
      const parent = nodes[parentId];
      const parentH = parent?.height ?? 0;
      for (const kidId of childOrder[parentId] ?? []) {
        const kid = nodes[kidId];
        if (!kid) continue;
        if (kid.type === "text") {
          const content = kid.content?.trim() ?? "";
          if (!content || TEXTFIELD_PLACEHOLDER_RE.test(content)) continue;
          if (TEXTFIELD_FLOAT_LABEL_RE.test(kid.codeClassName ?? "")) continue;
          const lineH = capturedLineHeightPx(kid);
          nodes[kidId] = {
            ...kid,
            y: Math.max(0, Math.round((parentH - lineH) / 2)),
            verticalAlign: "middle",
            layoutPositioning: "absolute",
            layoutSizingVertical: "fixed",
            ...textResizePatch("fixed"),
          };
          continue;
        }
        if (kid.type === "frame") walk(kidId);
      }
    };
    walk(boxId);
  }
}

const BRIDGE_SELECTED_CARD_RE = /\bob-flow-[a-z0-9-]+--selected\b/i;
const BRIDGE_SELECTABLE_CARD_RE =
  /\bob-flow-(?:select-card|sig-option|signature-option|sig-card)\b/i;

function hexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0]! + h[0], 16),
      g: parseInt(h[1]! + h[1], 16),
      b: parseInt(h[2]! + h[2], 16),
    };
  }
  if (h.length >= 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function isBridgePositiveSelectionSurface(fill: string | undefined): boolean {
  const hex = parseColor(fill ?? "");
  if (!hex) return false;
  const rgb = hexRgb(hex);
  if (!rgb) return false;
  if (rgb.g > rgb.r + 8 && rgb.g >= rgb.b + 4 && rgb.g > 180) return true;
  if (rgb.g > rgb.r + 4 && rgb.g > rgb.b && rgb.r > 220 && rgb.g > 230) return true;
  return false;
}

function isBridgeSelectedCardFrame(node: EditorNode): boolean {
  const cls = node.codeClassName ?? "";
  if (BRIDGE_SELECTED_CARD_RE.test(cls)) return true;
  return (
    BRIDGE_SELECTABLE_CARD_RE.test(cls) &&
    node.fillEnabled === true &&
    isBridgePositiveSelectionSurface(node.fill)
  );
}

function isBridgeOutlinedControlFrame(node: EditorNode, copy: string): boolean {
  const cls = node.codeClassName ?? "";
  if (isPmlIconButtonClassName(cls)) return false;
  if (hasPmlStrokeButtonClassToken(cls)) return true;
  if (!hasPmlButtonClassToken(cls)) return false;
  return /change\s*bank/i.test(copy);
}

function hasVisibleFrameStroke(node: EditorNode): boolean {
  return (
    node.strokeEnabled === true &&
    (node.strokeWidth ?? 0) >= 0.5 &&
    Boolean(parseColor(node.strokeColor ?? "") ?? node.strokeColor?.trim())
  );
}

function bridgeSubtreeText(
  nodeId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const n = nodes[nodeId];
  if (!n) return "";
  const parts: string[] = [];
  if (n.type === "text" && n.content) parts.push(n.content);
  for (const cid of childOrder[nodeId] ?? []) {
    const t = bridgeSubtreeText(cid, nodes, childOrder);
    if (t) parts.push(t);
  }
  return parts.join(" ");
}

function strokeColorFromCaptureEdgeChildren(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | undefined {
  for (const kidId of childOrder[parentId] ?? []) {
    const kid = nodes[kidId];
    if (!kid || !/\bcraft-capture-edge-(?:top|bottom|left|right)\b/.test(kid.codeClassName ?? "")) {
      continue;
    }
    const color = parseColor(kid.fill ?? "") ?? kid.fill?.trim();
    if (color) return color;
  }
  return undefined;
}

/** Outline CTAs (btn--stroke, Change Bank, etc.) must keep the live border as an editable frame stroke. */
export function ensureBridgeOutlinedControlStrokes(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: FinalizeBridgeLiveCaptureOptions = {},
): void {
  const theme = opts.theme ?? "light";
  const positiveBorder =
    resolveBridgeProjectCssVariable(opts.cssSources, "--border-positive-strong", theme) ??
    "#34A34D";
  const neutralBorder =
    resolveBridgeProjectCssVariable(opts.cssSources, "--border-neutral-medium", theme) ??
    "#E0E0E0";

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    const cls = node.codeClassName ?? "";
    if (!isBridgeOutlinedControlFrame(node, bridgeSubtreeText(id, nodes, childOrder))) continue;

    if (hasVisibleFrameStroke(node)) {
      const strokeColor =
        parseColor(node.strokeColor ?? "") ??
        strokeColorFromCaptureEdgeChildren(id, nodes, childOrder);
      const copy = bridgeSubtreeText(id, nodes, childOrder);
      const isPositiveStroke =
        hasPmlStrokeButtonClassToken(cls) ||
        /\bpositive\b/i.test(cls) ||
        /change\s*bank/i.test(copy);
      const needsInsideAlign = node.strokePosition !== "inside";
      const needsPositiveColor =
        isPositiveStroke &&
        strokeColor &&
        strokeColor.toLowerCase() !== positiveBorder.toLowerCase();
      if (needsInsideAlign || needsPositiveColor) {
        const strokePatch = mergeStrokeIntoNode(node, {
          strokeEnabled: true,
          strokeWidth: (node.strokeWidth ?? 0) >= 0.5 ? node.strokeWidth : 1,
          strokeColor: needsPositiveColor ? positiveBorder : strokeColor ?? positiveBorder,
          strokePosition: "inside",
        });
        nodes[id] = { ...node, ...strokePatch, clipChildren: false };
      } else if (node.clipChildren !== false) {
        nodes[id] = { ...node, clipChildren: false };
      }
      continue;
    }

    const copy = bridgeSubtreeText(id, nodes, childOrder);
    const fromEdges = strokeColorFromCaptureEdgeChildren(id, nodes, childOrder);
    const isPositiveStroke =
      hasPmlStrokeButtonClassToken(cls) ||
      /\bpositive\b/i.test(cls) ||
      /change\s*bank/i.test(copy);

    const strokeColor =
      fromEdges ??
      parseColor(node.strokeColor ?? "") ??
      (isPositiveStroke ? positiveBorder : neutralBorder);

    const strokePatch = mergeStrokeIntoNode(node, {
      strokeEnabled: true,
      strokeWidth: (node.strokeWidth ?? 0) >= 0.5 ? node.strokeWidth : 1,
      strokeColor,
      strokePosition: "inside",
    });
    nodes[id] = { ...node, ...strokePatch, clipChildren: false };
  }
}

/** Selected PML cards use inset box-shadow rings — ensure inside stroke on the frame. */
export function ensureBridgeSelectedCardInsetStrokes(
  nodes: Record<string, EditorNode>,
  opts: FinalizeBridgeLiveCaptureOptions = {},
): void {
  const theme = opts.theme ?? "light";
  const positiveBorder =
    resolveBridgeProjectCssVariable(opts.cssSources, "--border-positive-strong", theme) ??
    "#34A34D";

  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    if (!isBridgeSelectedCardFrame(node)) continue;

    const strokeColor = node.strokeColor?.trim() || positiveBorder;
    const strokePatch = mergeStrokeIntoNode(node, {
      strokeEnabled: true,
      strokeWidth: (node.strokeWidth ?? 0) >= 0.5 ? node.strokeWidth : 1,
      strokeColor,
      strokePosition: "inside",
    });
    nodes[id] = { ...node, ...strokePatch, clipChildren: false };
  }
}

const CAPTURE_EDGE_CLASS_RE = /\bcraft-capture-edge-(?:top|bottom|left|right)\b/;

function isBridgeCompactDigitInputHost(node: EditorNode): boolean {
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  if (w < 24 || w > 100 || h < 24 || h > 100) return false;
  const meta = `${node.codeClassName ?? ""} ${node.name ?? ""} ${node.codeJsxTag ?? ""}`;
  if (/digit|otp|pin|slot|cell/i.test(meta)) return true;
  if (node.codeJsxTag === "input") return true;
  return Math.abs(w - h) <= 8 && w <= 72;
}

function bridgeCompactDigitChildCount(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): number {
  return (childOrder[parentId] ?? []).filter((kidId) =>
    isBridgeCompactDigitInputHost(nodes[kidId]!),
  ).length;
}

function isBridgeOtpDigitRowHost(
  node: EditorNode,
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  if (bridgeCompactDigitChildCount(parentId, nodes, childOrder) >= 4) return true;
  const meta = `${node.codeClassName ?? ""} ${node.name ?? ""}`;
  return (
    bridgeCompactDigitChildCount(parentId, nodes, childOrder) >= 1 &&
    (/\botp\b/i.test(meta) || /^input$/i.test(node.name ?? ""))
  );
}

function isBridgeHorizontalCaptureEdge(node: EditorNode | undefined): boolean {
  if (!node) return false;
  return /\bcraft-capture-edge-(?:top|bottom)\b/.test(node.codeClassName ?? "");
}

function isBridgePositiveCalloutFrame(node: EditorNode): boolean {
  const cls = node.codeClassName ?? "";
  return (
    /\bob-flow__(?:message|hint|alert|info|callout)\b/i.test(cls) ||
    (/\btext-positive\b/i.test(cls) && node.fillEnabled === true)
  );
}

function isBridgePositiveCalloutText(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  if (/\btext-positive\b/i.test(node.codeClassName ?? "")) return true;
  let cur: string | null | undefined = node.parentId;
  while (cur) {
    const parent = nodes[cur];
    if (parent && isBridgePositiveCalloutFrame(parent)) return true;
    cur = parent?.parentId;
  }
  return false;
}

const OB_FLOW_COLUMN_INSET_PX = 24;

function isBridgeCaretLikeLayer(node: EditorNode | undefined): boolean {
  if (!node || node.type === "text") return false;
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  if (/\bcaret|cursor|blink\b/i.test(node.codeClassName ?? "")) return true;
  return w > 0 && w <= 3 && h >= 18;
}

function mergeCaptureEdgeSegmentsIntoFrameStroke(
  parentId: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const parent = nodes[parentId];
  if (!parent || parent.type !== "frame") return false;

  const kids = childOrder[parentId] ?? [];
  let edgeColor: string | undefined;
  const kept: string[] = [];
  let removed = false;
  for (const kidId of kids) {
    const kid = nodes[kidId];
    if (kid && CAPTURE_EDGE_CLASS_RE.test(kid.codeClassName ?? "")) {
      edgeColor = edgeColor ?? parseColor(kid.fill ?? "") ?? kid.fill?.trim();
      delete nodes[kidId];
      delete childOrder[kidId];
      removed = true;
      continue;
    }
    kept.push(kidId);
  }
  if (!removed) return false;

  childOrder[parentId] = kept;
  const hasStroke = parent.strokeEnabled === true && (parent.strokeWidth ?? 0) >= 0.5;
  if (!hasStroke && edgeColor) {
    nodes[parentId] = {
      ...parent,
      ...mergeStrokeIntoNode(parent, {
        strokeEnabled: true,
        strokeWidth: 1,
        strokeColor: edgeColor,
        strokePosition: "inside",
      }),
      clipChildren: false,
    };
  }
  return true;
}

/** Rounded CTAs use frame stroke — drop mistaken four-edge segment children from older captures. */
export function stripBridgeButtonBorderEdgeSegments(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    if (!hasPmlButtonClassToken(parent.codeClassName) || isPmlIconButtonClassName(parent.codeClassName)) {
      continue;
    }
    mergeCaptureEdgeSegmentsIntoFrameStroke(parentId, nodes, childOrder);
    void kids;
  }
}

/** OTP/PIN digit cells — merge left/right hairline segments into one rounded frame stroke. */
export function consolidateBridgeCompactControlBorderEdges(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    if (hasPmlButtonClassToken(parent.codeClassName) && !isPmlIconButtonClassName(parent.codeClassName)) {
      continue;
    }
    const edgeCount = kids.filter((kidId) =>
      CAPTURE_EDGE_CLASS_RE.test(nodes[kidId]?.codeClassName ?? ""),
    ).length;
    if (edgeCount === 0) continue;
    if (!isBridgeCompactDigitInputHost(parent) && edgeCount < 4) continue;
    mergeCaptureEdgeSegmentsIntoFrameStroke(parentId, nodes, childOrder);
  }
}

/**
 * OTP rows often capture a full-width horizontal hairline behind all digit boxes.
 * Drop row-level top/bottom edges and normalize each digit cell border.
 */
export function finalizeBridgeOtpDigitRowChrome(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const visit = (parentId: string): void => {
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") return;

    if (isBridgeOtpDigitRowHost(parent, parentId, nodes, childOrder)) {
      const kids = childOrder[parentId] ?? [];
      const kept: string[] = [];
      for (const kidId of kids) {
        const kid = nodes[kidId];
        if (isBridgeHorizontalCaptureEdge(kid)) {
          delete nodes[kidId];
          delete childOrder[kidId];
          continue;
        }
        kept.push(kidId);
      }
      childOrder[parentId] = kept;
      nodes[parentId] = { ...parent, clipChildren: false };

      for (const kidId of childOrder[parentId] ?? []) {
        const kid = nodes[kidId];
        if (!kid || kid.type !== "frame") continue;
        if (isBridgeCompactDigitInputHost(kid)) {
          mergeCaptureEdgeSegmentsIntoFrameStroke(kidId, nodes, childOrder);
        } else {
          visit(kidId);
        }
      }
      return;
    }

    for (const kidId of childOrder[parentId] ?? []) {
      visit(kidId);
    }
  };

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    visit(rootId);
  }
}

/** Drop focused-input caret bars captured as thin vertical layers inside digit cells. */
export function stripBridgeCompactInputCaretLayers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    if (!isBridgeCompactDigitInputHost(parent)) continue;

    const kept: string[] = [];
    let changed = false;
    for (const kidId of kids) {
      const kid = nodes[kidId];
      if (isBridgeCaretLikeLayer(kid)) {
        delete nodes[kidId];
        delete childOrder[kidId];
        changed = true;
        continue;
      }
      kept.push(kidId);
    }
    if (changed) childOrder[parentId] = kept;
  }
}

/** Keep synthetic divider layers from bridge capture visible and editable. */
export function preserveBridgeCapturedEdgeLayers(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    if (!/\bcraft-capture-edge-(?:top|bottom|left|right)\b/.test(node.codeClassName ?? "")) continue;
    const fill = node.fill?.trim();
    if (!fill) continue;
    nodes[id] = {
      ...node,
      name: "divider",
      fillEnabled: true,
      locked: false,
      clipChildren: false,
      layoutPositioning: "absolute",
    };
  }
}

/** Textfields captured with border-only styling often pick up page-gray fills — drop them. */
export function stripBridgeOutlineOnlyControlFills(nodes: Record<string, EditorNode>): void {
  const pageGrays = new Set(["#ffffff", "#fff", "#f5f5f5", "#fafafa", "#f4f4f5", "#ebecee"]);
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    const cls = node.codeClassName ?? "";
    if (!/textfield|__box|\binput\b/i.test(cls)) continue;
    if (node.strokeEnabled !== true || (node.strokeWidth ?? 0) < 0.5) continue;
    const fill = node.fill?.trim().toLowerCase();
    if (!fill || !pageGrays.has(fill)) continue;
    nodes[id] = { ...node, fillEnabled: false, fill: undefined };
  }
}

/** Header back/close icon taps must stay strokeless (not PML outline CTAs). */
export function stripBridgeSpuriousIconButtonStrokes(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame") continue;
    if (!isPmlIconButtonClassName(node.codeClassName)) continue;
    if (node.strokeEnabled !== true && (node.strokeWidth ?? 0) < 0.5) continue;
    nodes[id] = {
      ...node,
      strokeEnabled: false,
      strokeWidth: undefined,
      strokeColor: undefined,
      strokePosition: undefined,
    };
  }
}

/** Resolve CSS var() text colors and guarantee readable minimum bounds for captured labels. */
export function ensureBridgeCaptureTextVisible(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const content = node.content?.trim();
    if (!content) continue;

    let textColor = node.textColor ?? node.fill;
    const isLinkLabel =
      /\bob-flow-form__link\b/.test(node.codeClassName ?? "") ||
      BRIDGE_LINK_LABEL_RE.test(content) ||
      Boolean(bridgeLinkFrameAncestor(node, nodes));

    if (isLinkLabel) {
      textColor = BRIDGE_LINK_BLUE;
    } else {
      const parsed = textColor ? parseColor(textColor) : undefined;
      if (!parsed) {
        textColor = BOTTOM_NAV_LABEL_RE.test(node.codeClassName ?? "")
          ? BRIDGE_CONSENT_GRAY
          : bridgeCaptureTextColorFallback(node, nodes);
      } else {
        textColor = parsed;
      }
    }

    const fontSize = node.fontSize ?? 12;
    const lineH = capturedLineHeightPx(node);
    const patch: Partial<EditorNode> = {
      textColor,
      fill: textColor,
      fillEnabled: true,
      fillType: "solid",
    };
    if (isLinkLabel) {
      patch.textDecoration = "underline";
    }
    if ((node.height ?? 0) < lineH * 0.75) {
      patch.height = Math.ceil(Math.min(lineH, bridgeCaptureLineCapPx(node)));
    }
    if ((node.width ?? 0) < 8) {
      patch.width = Math.max(
        node.width,
        Math.ceil(content.length * fontSize * 0.58) + 4,
        BOTTOM_NAV_LABEL_RE.test(node.codeClassName ?? "") ? 40 : 8,
      );
    }
    nodes[id] = { ...node, ...patch };
  }
}

/** Keep bridge captures inside the phone column — scroll carousels must not bleed horizontally. */
export function enforceBridgeCaptureClipping(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "frame" && node.type !== "group") continue;
    if (isPhoneShellScrollClassName(node.codeClassName) || isPhoneShellClassName(node.codeClassName)) {
      nodes[id] = { ...nodes[id]!, clipChildren: true };
    }
    if (
      node.width > columnWidth &&
      (isPhoneShellClassName(node.codeClassName) || isPhoneShellScrollClassName(node.codeClassName))
    ) {
      nodes[id] = { ...nodes[id]!, width: columnWidth };
    }
  }

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const root = nodes[rootId];
    if (!root) continue;
    nodes[rootId] = {
      ...root,
      clipChildren: true,
      width: isPhoneShellClassName(root.codeClassName) ? columnWidth : root.width,
    };
  }
}

/** Pin captured coordinates — never reflow flex stacks on bridge push. */
export function pinBridgeCaptureChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    for (const kidId of kids) {
      const child = nodes[kidId];
      if (!child || child.visible === false) continue;
      nodes[kidId] = {
        ...child,
        layoutPositioning: "absolute",
        layoutSizingHorizontal: child.layoutSizingHorizontal ?? "fixed",
        layoutSizingVertical: child.layoutSizingVertical ?? "fixed",
        layoutDirty: false,
      };
    }
  }
}

/** Bridge capture skips normalizeWebImportTextNodes — fix percent line-height before any px math. */
export function normalizeBridgeCaptureTextTypography(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    let next = fixImportedTextLineHeightUnit(node);
    if (!TEXTFIELD_FLOAT_LABEL_RE.test(next.codeClassName ?? "")) {
      next = { ...next, verticalAlign: "top" as const, bridgeDomTextBox: true };
    }
    nodes[id] = next;
  }
}

function capturedLineHeightPx(node: EditorNode): number {
  return resolveLineHeightPxFromNode(node);
}

function bridgeCaptureInkHeight(node: EditorNode, content: string): number {
  const lineCap = bridgeCaptureLineCapPx(node);
  const linePx = Math.ceil(capturedLineHeightPx(node));
  const typo = resolveTextTypo({ ...node, content, bridgeDomTextBox: true });
  const style = textAdvancedStyleFromNode(node);
  const display = prepareTextForDisplay(content, style);
  const innerW = textInnerWidth(Math.max(MIN_TEXT_BOX, node.width ?? MIN_TEXT_BOX));
  const layout = layoutText(display, innerW, typo, style);
  const contentH = hugContentHeightForLayout(layout, typo);
  const inkH = content.includes("\n") ? contentH : measureTextPaintHeight(display, typo);
  return Math.max(lineCap, linePx, Math.ceil(contentH), Math.ceil(inkH));
}

function bridgeCaptureMinTextHeight(node: EditorNode, content: string): number {
  const captured = node.height ?? 0;
  return Math.max(captured, bridgeCaptureInkHeight(node, content));
}

function isBridgeCapturedSingleLine(
  node: EditorNode,
  content: string,
  maxWidth: number = PML_PHONE_COLUMN_WIDTH,
): boolean {
  if (!content || content.includes("\n")) return false;
  if (node.browserTextLayout?.lines && node.browserTextLayout.lines.length > 1) return false;

  const needW = measuredTextWidth(node, content);
  if (needW > maxWidth + 2) return false;

  const linePx = capturedLineHeightPx(node);
  return (
    (node.height ?? 0) <= linePx * 1.6 || node.browserTextLayout?.lines?.length === 1
  );
}

function bridgeParentTextMaxWidth(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  columnWidth: number,
): number {
  const parent = node.parentId ? nodes[node.parentId] : undefined;
  if (!parent) return columnWidth;
  const padL = parent.paddingLeft ?? 0;
  const padR = parent.paddingRight ?? 0;
  return Math.max(MIN_TEXT_BOX, parent.width - padL - padR - Math.max(0, node.x - padL));
}

/** Widen single-line DOM text so Craft's font engine does not reflow onto extra lines. */
function bridgeSingleLineFitWidth(
  node: EditorNode,
  content: string,
  maxWidth: number,
): number {
  let needW = Math.max(Math.ceil(node.width ?? MIN_TEXT_BOX), measuredTextWidth(node, content));
  if (node.browserTextLayout?.lines?.length === 1) {
    needW = Math.max(needW, bridgeCapturedInkWidth(node));
  }
  return Math.min(Math.ceil(needW), Math.max(MIN_TEXT_BOX, Math.floor(maxWidth)));
}

function bridgeFooterLinkColumnWidth(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  columnWidth: number,
): number {
  const parent = node.parentId ? nodes[node.parentId] : undefined;
  if (!parent) return columnWidth;
  const padL = parent.paddingLeft ?? 0;
  const padR = parent.paddingRight ?? 0;
  return Math.max(MIN_TEXT_BOX, parent.width - padL - padR);
}

function isBridgeRightAlignedInParent(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
): boolean {
  const parent = node.parentId ? nodes[node.parentId] : undefined;
  if (!parent) return false;
  const padL = parent.paddingLeft ?? 0;
  const padR = parent.paddingRight ?? 0;
  const maxRight = parent.width - padR;
  const right = node.x + (node.width ?? 0);
  if ((node.textAlign ?? "").toLowerCase() === "right") return true;
  return right >= maxRight - 10;
}

function layoutBridgeFooterLinkPatch(
  node: EditorNode,
  content: string,
  nodes: Record<string, EditorNode>,
  columnWidth: number,
): Partial<EditorNode> {
  const parent = node.parentId ? nodes[node.parentId] : undefined;
  const padL = parent?.paddingLeft ?? 0;
  const padR = parent?.paddingRight ?? 0;
  const maxRight = parent ? parent.width - padR : columnWidth;
  const columnInner = bridgeFooterLinkColumnWidth(node, nodes, columnWidth);

  let needW = Math.max(Math.ceil(node.width ?? MIN_TEXT_BOX), measuredTextWidth(node, content));
  if (node.browserTextLayout?.lines?.length === 1) {
    needW = Math.max(needW, bridgeCapturedInkWidth(node));
  }
  const fitW = Math.min(Math.ceil(needW + 2), columnInner);

  const lineCap = bridgeCaptureLineCapPx(node);
  const rightAligned = isBridgeRightAlignedInParent(node, nodes);
  const x = rightAligned ? Math.max(padL, maxRight - fitW) : Math.max(padL, node.x);

  return {
    x,
    width: fitW,
    height: Math.max(lineCap, Math.min(node.height ?? lineCap, lineCap * 1.35)),
    bridgeDomTextBox: true,
    verticalAlign: "top",
    layoutSizingHorizontal: "fixed",
    layoutSizingVertical: "fixed",
    textAlign: rightAligned ? "right" : node.textAlign,
    ...textResizePatch("fixed"),
  };
}

/** Right-aligned footer links (Forgot PIN, Resend OTP) need full ink width, not leftover space from x. */
export function fitBridgeFooterLinkText(
  nodes: Record<string, EditorNode>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const content = node.content?.trim() ?? "";
    if (!isBridgeSingleLineFooterLink(node, content)) continue;
    nodes[id] = {
      ...node,
      ...layoutBridgeFooterLinkPatch(node, content, nodes, columnWidth),
    };
  }
}

function isBridgeSingleLineFooterLink(node: EditorNode, content: string): boolean {
  const cls = node.codeClassName ?? "";
  if (/\botp_timer\b|\bob-flow-form__link\b|\bob-flow__link\b/i.test(cls)) return true;
  const t = content.trim();
  if (/^Resend OTP(?:\s+in\s+\d+s)?$/i.test(t)) return true;
  if (/^Forgot my PIN$/i.test(t)) return true;
  return false;
}

/** Pattern fix: browser single-line labels/headings must stay one line on canvas. */
export function expandBridgeSingleLineTextWidths(
  nodes: Record<string, EditorNode>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    if (TEXTFIELD_FLOAT_LABEL_RE.test(node.codeClassName ?? "")) continue;

    const content = node.content?.trim() ?? "";
    const maxW = bridgeParentTextMaxWidth(node, nodes, columnWidth);
    if (isBridgeSingleLineFooterLink(node, content)) continue;

    if (!isBridgeCapturedSingleLine(node, content, maxW)) continue;

    const fitW = bridgeSingleLineFitWidth(node, content, maxW);
    if (fitW <= (node.width ?? 0) + 1) continue;

    nodes[id] = {
      ...node,
      width: fitW,
      bridgeDomTextBox: true,
      verticalAlign: "top",
      layoutSizingHorizontal: "fixed",
      ...textResizePatch("fixed"),
    };
  }
}

/** Expand every bridge text box so Craft glyphs fit inside the layer frame (no self-clip). */
export function ensureBridgeTextFitsOwnFrame(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    if (TEXTFIELD_FLOAT_LABEL_RE.test(node.codeClassName ?? "")) continue;
    if (/\bbn__label\b/.test(node.codeClassName ?? "")) continue;
    if (/\bbadge__label\b/.test(node.codeClassName ?? "")) continue;

    const content = node.content ?? "";
    if (isBridgeSingleLineFooterLink(node, content.trim())) continue;
    if (isBridgePositiveCalloutText(node, nodes)) continue;
    const maxW = bridgeParentTextMaxWidth(node, nodes, PML_PHONE_COLUMN_WIDTH);
    const fitNode =
      isBridgeCapturedSingleLine(node, content, maxW) && node.parentId
        ? {
            ...node,
            width: bridgeSingleLineFitWidth(node, content, maxW),
          }
        : node;
    const minH = bridgeCaptureMinTextHeight(fitNode, content);
    const wrapped = !isBridgeCapturedSingleLine(node, content, maxW);
    nodes[id] = {
      ...fitNode,
      bridgeDomTextBox: true,
      verticalAlign: "top",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: wrapped ? "hug" : "fixed",
      layoutPositioning: node.layoutPositioning ?? "absolute",
      height: Math.max(node.height ?? 0, minH),
      ...textResizePatch(wrapped ? "auto-height" : "fixed"),
    };
  }
}

/**
 * Map captured browser text rects onto Craft text boxes without remeasuring widths.
 * Playwright DOM geometry is the source of truth for bridge push fidelity.
 */
export function layoutBridgeCaptureTextNode(
  node: EditorNode,
  content: string,
  maxWidth: number = PML_PHONE_COLUMN_WIDTH,
): EditorNode {
  const singleLine = isBridgeCapturedSingleLine(node, content, maxWidth);
  const fitWidth = singleLine
    ? bridgeSingleLineFitWidth(node, content, maxWidth)
    : Math.ceil(node.width ?? MIN_TEXT_BOX);
  const minHeight = bridgeCaptureMinTextHeight({ ...node, width: fitWidth }, content);

  let next: EditorNode = {
    ...node,
    browserTextLayout: undefined,
    bridgeDomTextBox: true,
    verticalAlign: "top",
    layoutSizingHorizontal: "fixed",
    layoutSizingVertical: "fixed",
    width: fitWidth,
    height: minHeight,
    ...textResizePatch(singleLine ? "fixed" : "auto-height"),
  };

  if (!singleLine) {
    const patch = textLayoutPatchForNode(next, content);
    if (patch?.height && patch.height > next.height) {
      next = { ...next, height: patch.height };
    }
  }

  return next;
}

/** Render bridge text with Craft's layout engine (same as native text layers), not browser glyph paint. */
export function applyBridgeCaptureCraftTextSemantics(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    if (TEXTFIELD_FLOAT_LABEL_RE.test(node.codeClassName ?? "")) continue;
    const content = node.content ?? "";
    if (isBridgeSingleLineFooterLink(node, content.trim())) continue;
    if (isBridgePositiveCalloutText(node, nodes)) continue;
    nodes[id] = layoutBridgeCaptureTextNode(
      node,
      node.content ?? "",
      bridgeParentTextMaxWidth(node, nodes, PML_PHONE_COLUMN_WIDTH),
    );
  }
}

/**
 * Size every captured text box with Craft's font engine so nothing clips, anchored to
 * the captured position. Re-anchoring lives in layoutBridgeCaptureTextNode, so the
 * left-anchoring web-import normalizers are intentionally not run here.
 */
export function fitBridgeCaptureTextBounds(nodes: Record<string, EditorNode>): void {
  preserveBridgeCaptureTextGeometry(nodes);
}

/** @deprecated Use fitBridgeCaptureTextBounds */
export const freezeBridgeCaptureTextBounds = fitBridgeCaptureTextBounds;

function visibleChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): EditorNode[] {
  return (childOrder[parentId] ?? [])
    .map((id) => nodes[id])
    .filter((n): n is EditorNode => !!n && n.visible !== false);
}

/**
 * Record parents whose children were horizontally centered as a group in the browser
 * (equal left/right gap). Captured from raw DOM geometry before any text resizing.
 */
export function captureCenteredGroupParents(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  tolerance = 2,
): Set<string> {
  const centered = new Set<string>();
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY || kids.length === 0) continue;
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    const vis = visibleChildren(nodes, childOrder, parentId);
    if (vis.length === 0) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const kid of vis) {
      minX = Math.min(minX, kid.x);
      maxX = Math.max(maxX, kid.x + kid.width);
    }
    const leftGap = minX;
    const rightGap = parent.width - maxX;
    if (leftGap > tolerance && Math.abs(leftGap - rightGap) <= tolerance) {
      centered.add(parentId);
    }
  }
  return centered;
}

/** Re-center marked groups after text resizing so flex `justify-content: center` is preserved. */
export function recenterCapturedGroups(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  centered: Set<string>,
): void {
  for (const parentId of centered) {
    const parent = nodes[parentId];
    if (!parent) continue;
    const vis = visibleChildren(nodes, childOrder, parentId);
    if (vis.length === 0) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const kid of vis) {
      minX = Math.min(minX, kid.x);
      maxX = Math.max(maxX, kid.x + kid.width);
    }
    const groupWidth = maxX - minX;
    const desiredMinX = Math.round((parent.width - groupWidth) / 2);
    const dx = desiredMinX - minX;
    if (Math.abs(dx) < 1) continue;
    for (const id of childOrder[parentId] ?? []) {
      const n = nodes[id];
      if (!n) continue;
      nodes[id] = { ...n, x: n.x + dx };
    }
  }
}

type InlineFragment =
  | { kind: "text"; id: string }
  | { kind: "link"; frameId: string; labelId: string };

/** A child is an inline fragment if it is a text node or a frame wrapping a single text label. */
function inlineFragmentOf(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  childId: string,
): InlineFragment | null {
  const n = nodes[childId];
  if (!n || n.visible === false) return null;
  if (n.type === "text") {
    return (n.content ?? "").length > 0 ? { kind: "text", id: childId } : null;
  }
  if (n.type === "frame") {
    const kids = (childOrder[childId] ?? []).filter((k) => nodes[k]?.visible !== false);
    if (kids.length !== 1) return null;
    const only = nodes[kids[0]!];
    if (only?.type === "text" && (only.content ?? "").length > 0) {
      return { kind: "link", frameId: childId, labelId: kids[0]! };
    }
  }
  return null;
}

function fragmentText(nodes: Record<string, EditorNode>, f: InlineFragment): EditorNode {
  return f.kind === "text" ? nodes[f.id]! : nodes[f.labelId]!;
}

function isProtectedCoalesceParent(
  parent: EditorNode,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): boolean {
  const cls = parent.codeClassName ?? "";
  if (isBottomNavContainer(parent)) return true;
  if (/\bbn__/.test(cls)) return true;
  if (CONSENT_TEXT_CLASS_RE.test(cls)) return true;
  if (/\bob-flow-form__tc-text\b/.test(cls)) return true;
  if (LIST_ITEM_ROW_CLASS_RE.test(cls) && !LIST_ITEM_TEXT_CLASS_RE.test(cls)) return true;
  if (/\bli-item__/.test(cls)) return true;
  for (const kidId of childOrder[parent.id] ?? []) {
    const kid = nodes[kidId];
    if (!kid) continue;
    if (LIST_ITEM_TEXT_CLASS_RE.test(kid.codeClassName ?? "")) return true;
    if (BOTTOM_NAV_LABEL_RE.test(kid.codeClassName ?? "")) return true;
  }
  return false;
}

function isProtectedCoalesceFragment(
  nodes: Record<string, EditorNode>,
  f: InlineFragment,
): boolean {
  const text = fragmentText(nodes, f);
  const cls = text.codeClassName ?? "";
  if (BOTTOM_NAV_LABEL_RE.test(cls) || LIST_ITEM_TEXT_CLASS_RE.test(cls)) return true;
  if (CONSENT_TEXT_CLASS_RE.test(cls) || /\bob-flow-form__link\b/.test(cls)) return true;
  const box = f.kind === "text" ? nodes[f.id] : nodes[f.frameId];
  const boxCls = box?.codeClassName ?? "";
  return /\bbn__/.test(boxCls) || /\bli-item\b/.test(boxCls);
}

function fragmentBounds(nodes: Record<string, EditorNode>, f: InlineFragment) {
  if (f.kind === "text") return nodes[f.id]!;
  const frame = nodes[f.frameId]!;
  const label = nodes[f.labelId]!;
  return {
    x: frame.x + label.x,
    y: frame.y + label.y,
    width: label.width,
    height: label.height,
  };
}

type ConsentSegment = { text: string; link: boolean };

function parseConsentLinkSegments(content: string): ConsentSegment[] | null {
  if (!/\bT&Cs\b/i.test(content) || !/\bPrivacy Policy\b/i.test(content)) return null;
  const segments: ConsentSegment[] = [];
  const re = /(T&Cs|Privacy Policy)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) segments.push({ text: content.slice(last, m.index), link: false });
    segments.push({ text: m[1]!, link: true });
    last = m.index + m[1]!.length;
  }
  if (last < content.length) segments.push({ text: content.slice(last), link: false });
  if (segments.filter((s) => s.link).length < 2) return null;
  return segments.filter((s) => s.text.length > 0);
}

function parseTrailingReadMoreSegment(content: string): ConsentSegment[] | null {
  const match = content.match(/^(.*?)(\s*)(Read more)\s*$/i);
  if (!match?.[1]?.trim() || !match[3]) return null;
  return [
    { text: match[1]! + (match[2] ?? ""), link: false },
    { text: match[3]!, link: true },
  ];
}

function parseBridgeInlineLinkSegments(content: string): ConsentSegment[] | null {
  return parseConsentLinkSegments(content) ?? parseTrailingReadMoreSegment(content);
}

/**
 * Craft text nodes are single-style — split a merged consent sentence back into
 * gray body + blue link runs when coalesce/DOM flatten combined them.
 */
export function splitBridgeConsentLinkRuns(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [id, node] of Object.entries({ ...nodes })) {
    if (node.type !== "text") continue;
    const segments = parseBridgeInlineLinkSegments(node.content ?? "");
    if (!segments || segments.length < 2) continue;
    const parentId = node.parentId;
    if (!parentId) continue;

    const lineCap = bridgeCaptureLineCapPx(node);
    const newIds: string[] = [];
    let x = node.x;

    segments.forEach((seg, i) => {
      const segId = `${id}__run${i}`;
      const draft = { ...node, content: seg.text };
      const width = measuredTextWidth(draft, seg.text);
      const color = seg.link ? BRIDGE_LINK_BLUE : BRIDGE_CONSENT_GRAY;
      nodes[segId] = {
        ...node,
        id: segId,
        name: seg.text.trim().slice(0, 48) || "Text",
        content: seg.text,
        x,
        y: node.y,
        width,
        height: lineCap,
        fill: color,
        textColor: color,
        fillEnabled: true,
        codeClassName: seg.link ? "ob-flow-form__link" : node.codeClassName,
        textDecoration: seg.link ? "underline" : node.textDecoration,
        verticalAlign: "middle",
        ...textResizePatch("fixed"),
      };
      newIds.push(segId);
      x += width;
    });

    delete nodes[id];
    const kids = childOrder[parentId] ?? [];
    childOrder[parentId] = kids.flatMap((kid) => (kid === id ? newIds : [kid]));
  }
}

/**
 * Merge inline rich-text rows (e.g. "I agree … T&Cs … Privacy") into one editable text
 * layer at the captured row bounds. Keeps absolute DOM geometry instead of reflowing with
 * Craft flex metrics (which never match Chromium pixel-for-pixel).
 */
export function coalesceBridgeInlineTextRows(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    if (isProtectedCoalesceParent(parent, nodes, childOrder)) continue;
    const visible = kids.filter((k) => nodes[k]?.visible !== false);
    if (visible.length < 2) continue;

    const frags = visible.map((k) => inlineFragmentOf(nodes, childOrder, k));
    if (frags.some((f) => f === null)) continue;
    const fragments = frags as InlineFragment[];
    if (fragments.length < 2) continue;
    if (fragments.some((f) => isProtectedCoalesceFragment(nodes, f))) continue;

    const fontSizes = fragments.map((f) => fragmentText(nodes, f).fontSize ?? 14);
    if (Math.max(...fontSizes) - Math.min(...fontSizes) > 1) continue;

    const centers = fragments.map((f) => {
      const box = fragmentBounds(nodes, f);
      return box.y + box.height / 2;
    });
    const lineH = Math.round(
      Math.max(...fragments.map((f) => capturedLineHeightPx(fragmentText(nodes, f)))),
    );
    if (Math.max(...centers) - Math.min(...centers) > lineH * 0.75) continue;

    const sorted = [...fragments].sort(
      (a, b) => fragmentBounds(nodes, a).x - fragmentBounds(nodes, b).x,
    );
    const mergedContent = sorted
      .map((f) => (fragmentText(nodes, f).content ?? "").trim())
      .filter(Boolean)
      .join(" ");

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const f of fragments) {
      const box = fragmentBounds(nodes, f);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }

    const template = fragmentText(nodes, sorted[0]!);
    const rowHeight = Math.max(1, Math.ceil(maxY - minY));
    const mergedId = `${parentId}__merged-text`;
    nodes[mergedId] = {
      ...template,
      id: mergedId,
      parentId,
      type: "text",
      name: mergedContent.slice(0, 48) || "Text",
      content: mergedContent,
      x: minX,
      y: minY,
      width: Math.max(1, Math.ceil(maxX - minX)),
      height: Math.min(rowHeight, bridgeCaptureLineCapPx(template)),
      layoutPositioning: "absolute",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "fixed",
      ...textResizePatch("fixed"),
      verticalAlign: "middle",
    };

    for (const f of fragments) {
      if (f.kind === "text") delete nodes[f.id];
      else {
        delete nodes[f.labelId];
        delete nodes[f.frameId];
      }
    }
    childOrder[parentId] = [mergedId];
  }
}

/** @deprecated Prefer coalesceBridgeInlineTextRows — flex reflow breaks pixel fidelity. */
export function applyInlineRowAutoLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (parentId === EDITOR_ROOT_KEY) continue;
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    const visible = kids.filter((k) => nodes[k]?.visible !== false);
    if (visible.length < 2) continue;

    const frags = visible.map((k) => inlineFragmentOf(nodes, childOrder, k));
    if (frags.some((f) => f === null)) continue; // pure inline text row only
    const fragments = frags as InlineFragment[];
    if (fragments.length < 2) continue;

    // Single visual line only: fragment vertical centers must cluster together (skip stacks).
    const centers = fragments.map((f) => {
      const box = f.kind === "text" ? nodes[f.id]! : nodes[f.frameId]!;
      return box.y + box.height / 2;
    });
    const lineH = Math.round(
      Math.max(...fragments.map((f) => capturedLineHeightPx(fragmentText(nodes, f)))),
    );
    if (Math.max(...centers) - Math.min(...centers) > lineH * 0.75) continue;

    const fontSize = Math.max(...fragments.map((f) => fragmentText(nodes, f).fontSize ?? 14));
    const gap = Math.max(2, Math.round(fontSize * 0.27));

    nodes[parentId] = {
      ...parent,
      layoutMode: "horizontal",
      layoutWrap: true,
      layoutGap: gap,
      layoutGapAuto: false,
      primaryAxisAlign: "start",
      counterAxisAlign: "center",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "hug",
    };

    for (const f of fragments) {
      if (f.kind === "text") {
        nodes[f.id] = {
          ...nodes[f.id]!,
          layoutPositioning: "auto",
          layoutSizingHorizontal: "hug",
          layoutSizingVertical: "hug",
          ...textResizePatch("auto-width"),
          verticalAlign: "middle",
        };
      } else {
        nodes[f.frameId] = {
          ...nodes[f.frameId]!,
          layoutMode: "horizontal",
          layoutPositioning: "auto",
          layoutSizingHorizontal: "hug",
          layoutSizingVertical: "hug",
          paddingTop: 0,
          paddingRight: 0,
          paddingBottom: 0,
          paddingLeft: 0,
        };
        nodes[f.labelId] = {
          ...nodes[f.labelId]!,
          x: 0,
          y: 0,
          layoutPositioning: "auto",
          layoutSizingHorizontal: "hug",
          layoutSizingVertical: "hug",
          ...textResizePatch("auto-width"),
          verticalAlign: "middle",
        };
      }
    }
  }
}

/**
 * Bottom nav tabs sometimes sum wider than the phone column after capture.
 * Shrink width only — never change x/y (sections use horizontal inset, e.g. 16px).
 */
export function clampBottomNavWidths(
  nodes: Record<string, EditorNode>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (!isBottomNavContainer(node)) continue;
    if (node.width <= columnWidth) continue;
    nodes[id] = { ...node, width: columnWidth };
  }
}

/** Keep bridge body copy inside its parent column — prevents subtitles spilling off-screen. */
export function clampBridgeTextToParentBounds(
  nodes: Record<string, EditorNode>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    const content = node.content?.trim() ?? "";
    if (isBridgeSingleLineFooterLink(node, content)) continue;
    const parentId = node.parentId;
    if (!parentId) continue;
    const parent = nodes[parentId];
    if (!parent) continue;

    const padL = parent.paddingLeft ?? 0;
    const padR = parent.paddingRight ?? 0;
    const maxRight = parent.width - padR;
    const right = node.x + node.width;
    if (right <= maxRight + 2 && node.x >= padL - 2) continue;

    const newX = Math.max(padL, node.x);
    const newW = Math.max(MIN_TEXT_BOX, Math.floor(maxRight - newX));
    const patch: Partial<EditorNode> = {
      x: newX,
      width: newW,
      bridgeDomTextBox: true,
      verticalAlign: "top",
      layoutSizingHorizontal: "fixed",
      ...textResizePatch("fixed"),
    };
    nodes[id] = { ...node, ...patch };
  }
}

/** Positive callout copy must wrap inside the tinted box with readable green text. */
export function layoutBridgePositiveCalloutText(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [frameId, frame] of Object.entries(nodes)) {
    if (frame.type !== "frame" || !isBridgePositiveCalloutFrame(frame)) continue;

    const padL = frame.paddingLeft ?? 12;
    const padR = frame.paddingRight ?? 12;
    const padB = frame.paddingBottom ?? 8;
    const innerW = Math.max(MIN_TEXT_BOX, frame.width - padL - padR);
    let maxBottom = padL;

    for (const kidId of childOrder[frameId] ?? []) {
      const kid = nodes[kidId];
      if (kid?.type !== "text") continue;
      const content = kid.content?.trim() ?? "";
      if (!content) continue;

      const x = Math.max(padL, kid.x);
      const w = innerW;
      const minH = bridgeCaptureInkHeight(
        { ...kid, width: w, bridgeDomTextBox: true },
        content,
      );
      const y = Math.max(padL, kid.y);
      nodes[kidId] = {
        ...kid,
        x,
        y,
        width: w,
        height: Math.max(minH, bridgeCaptureLineCapPx(kid)),
        textColor: "#158939",
        fill: "#158939",
        fillEnabled: true,
        fillType: "solid",
        bridgeDomTextBox: true,
        verticalAlign: "top",
        layoutSizingHorizontal: "fixed",
        layoutSizingVertical: "fixed",
        ...textResizePatch("fixed"),
      };
      maxBottom = Math.max(maxBottom, y + (nodes[kidId]!.height ?? 0));
    }

    nodes[frameId] = {
      ...frame,
      clipChildren: false,
      height: Math.max(frame.height ?? 0, maxBottom + padB),
    };
  }
}

/** Clamp body copy to the phone column using absolute coordinates (not just parent box). */
export function clampBridgeTextToColumnWidth(
  nodes: Record<string, EditorNode>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
): void {
  const maxScreenRight = columnWidth - OB_FLOW_COLUMN_INSET_PX;
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    if (isBridgeTextInsideTextfield(node, nodes)) continue;
    const content = node.content?.trim() ?? "";
    if (isBridgeSingleLineFooterLink(node, content)) continue;
    if (isBridgePositiveCalloutText(node, nodes)) continue;
    if (isBridgeAssuranceHeaderLabel(node)) continue;
    if (/\b(?:dp__top-label|dp__data|bn__label|badge__label)\b/.test(node.codeClassName ?? "")) {
      continue;
    }

    const abs = absoluteOffset(id, nodes);
    const right = abs.x + node.width;
    if (right <= maxScreenRight + 1) continue;

    // Only clamp left-column body copy (headings/subtitles). Right-aligned header badges
    // and pan-card column labels are positioned intentionally past the inset.
    if (abs.x > OB_FLOW_COLUMN_INSET_PX + 8) continue;

    const contentLeft = Math.max(abs.x, OB_FLOW_COLUMN_INSET_PX);
    const newW = Math.max(MIN_TEXT_BOX, Math.floor(maxScreenRight - contentLeft));
    const wrapped = bridgeTextWrapsAtCapturedWidth({ ...node, width: newW }, content);
    const minH = wrapped
      ? bridgeCaptureInkHeight({ ...node, width: newW, bridgeDomTextBox: true }, content)
      : node.height ?? bridgeCaptureLineCapPx(node);
    nodes[id] = {
      ...node,
      width: newW,
      height: Math.max(node.height ?? 0, minH),
      bridgeDomTextBox: true,
      verticalAlign: "top",
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "fixed",
      ...textResizePatch("fixed"),
    };
  }
}

/** Positive callouts must not clip wrapped copy; re-apply readable green after text layout. */
export function prepareBridgeCalloutFrames(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  layoutBridgePositiveCalloutText(nodes, childOrder);
  ensureBridgeTextOnFilledParent(nodes);
}

/** Ensure text on filled callout/alert frames stays readable (green on green, etc.). */
export function ensureBridgeTextOnFilledParent(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== "text") continue;
    const parent = node.parentId ? nodes[node.parentId] : undefined;
    if (!parent?.fillEnabled || !parent.fill) continue;

    const cls = `${node.codeClassName ?? ""} ${parent.codeClassName ?? ""}`;
    const isCallout =
      /\b(?:callout|alert|notice|info|message|banner|hint|positive|negative|warning)\b/i.test(cls) ||
      /\bob-flow__(?:message|hint|alert|info|callout)\b/i.test(cls);

    let textColor = node.textColor ?? node.fill;
    const parsed = textColor ? parseColor(textColor) : undefined;

    if (isCallout && /\b(?:text-positive|positive|notice)\b/i.test(cls)) {
      textColor = ensureReadableTextColor("#158939", parent.fill) ?? "#158939";
    } else if (!parsed) {
      textColor = bridgeCaptureTextColorFallback(node, nodes);
    } else {
      textColor = ensureReadableTextColor(parsed, parent.fill) ?? parsed;
    }

    nodes[id] = {
      ...node,
      textColor,
      fill: textColor,
      fillEnabled: true,
      fillType: "solid",
    };
  }
}

/** Welcome brand stacks (logo + tagline) must not clip the subtitle below the mark. */
export function expandBridgeWelcomeBrandFrames(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const BRAND_STACK_RE = /\bob-flow-welcome(?:__|-)(?:brand|logo|header)\b/i;
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || (parent.type !== "frame" && parent.type !== "group")) continue;
    if (!BRAND_STACK_RE.test(parent.codeClassName ?? "")) continue;

    let maxY = 0;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c || c.visible === false) continue;
      maxY = Math.max(maxY, c.y + c.height);
    }
    if (maxY <= parent.height + 1) continue;
    nodes[parentId] = {
      ...parent,
      height: Math.ceil(maxY + 2),
      clipChildren: false,
    };
  }
}

/** Hint / assurance icon+text rows must not clip labels (overflow hidden on short rows). */
export function expandBridgeIconTextRowFrames(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  const ICON_TEXT_ROW_RE =
    /\bob-flow(?:__|-)(?:hint|assurance)\b|hint-row|hint-list|hint_list/i;

  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;

    const visibleKids = kids
      .map((id) => nodes[id])
      .filter((n): n is EditorNode => !!n && n.visible !== false);
    const hasText = visibleKids.some((n) => n.type === "text" && (n.content ?? "").trim());
    const hasIcon = visibleKids.some((n) => isBridgeBadgeIconNode(n));
    if (!hasText || !hasIcon) continue;

    const cls = parent.codeClassName ?? "";
    const name = parent.name ?? "";
    const knownRow = ICON_TEXT_ROW_RE.test(cls) || ICON_TEXT_ROW_RE.test(name);

    let maxY = 0;
    for (const kid of visibleKids) {
      maxY = Math.max(maxY, kid.y + kid.height);
    }
    const needH = Math.ceil(maxY + 2);
    const overflows = needH > parent.height + 1;
    if (!knownRow && !overflows && parent.clipChildren === false) continue;

    nodes[parentId] = {
      ...parent,
      height: Math.max(parent.height, needH),
      clipChildren: false,
    };
  }
}

/** Tab frames often clip bn__label — expand height and stop clipping icon + label stacks. */
export function expandBottomNavTabFrames(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || parent.type !== "frame") continue;
    const labelKids = kids.filter((id) =>
      BOTTOM_NAV_LABEL_RE.test(nodes[id]?.codeClassName ?? ""),
    );
    if (labelKids.length === 0) continue;

    let maxY = 0;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c || c.visible === false) continue;
      maxY = Math.max(maxY, c.y + c.height);
    }
    const needH = Math.ceil(maxY + 2);
    nodes[parentId] = {
      ...parent,
      height: Math.max(parent.height, needH),
      clipChildren: false,
    };
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (!isBottomNavContainer(node)) continue;
    const kids = childOrder[id] ?? [];
    let maxY = 0;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c || c.visible === false) continue;
      maxY = Math.max(maxY, c.y + c.height);
    }
    if (maxY > node.height) {
      nodes[id] = { ...node, height: Math.ceil(maxY + 4), clipChildren: false };
    }
  }
}

const SIG_DRAW_BOX_RE = /\bob-flow-sig-draw(?:__box|__pad)?\b|\bsig-draw.*__box\b/i;
const SIG_DRAW_PLACEHOLDER_RE = /^sign here$/i;

/** Filled signature pad uses dashed outline — hide placeholder and ensure dashed stroke. */
export function ensureBridgeSigDrawPadChrome(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  opts: FinalizeBridgeLiveCaptureOptions = {},
): void {
  const theme = opts.theme ?? "light";
  const borderColor =
    resolveBridgeProjectCssVariable(opts.cssSources, "--border-neutral-medium", theme) ??
    "#C4C4C4";

  for (const [boxId, box] of Object.entries(nodes)) {
    if (box.type !== "frame") continue;
    if (!SIG_DRAW_BOX_RE.test(box.codeClassName ?? "")) continue;

    const kids = visibleChildren(nodes, childOrder, boxId);
    const hasInk = kids.some(
      (k) => !(k.type === "text" && SIG_DRAW_PLACEHOLDER_RE.test(k.content?.trim() ?? "")),
    );
    if (!hasInk) continue;

    for (const kid of kids) {
      if (kid.type === "text" && SIG_DRAW_PLACEHOLDER_RE.test(kid.content?.trim() ?? "")) {
        nodes[kid.id] = { ...kid, visible: false };
      }
    }

    const strokePatch = mergeStrokeIntoNode(box, {
      strokeEnabled: true,
      strokeWidth: (box.strokeWidth ?? 0) >= 0.5 ? box.strokeWidth : 1,
      strokeStyle: "dashed",
      strokeColor: box.strokeColor?.trim() || borderColor,
      strokePosition: "inside",
    });
    nodes[boxId] = { ...box, ...strokePatch, clipChildren: false };
  }
}

/**
 * Bridge live capture: preserve Playwright x/y/width/height and browserTextLayout.
 * Reflow only inline consent rows where flex capture stacks fragments at the same x.
 */
export function finalizeBridgeLiveCapture(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  columnWidth: number = PML_PHONE_COLUMN_WIDTH,
  opts: FinalizeBridgeLiveCaptureOptions = {},
): void {
  normalizeBridgeCaptureTextTypography(nodes);
  pinBridgeCaptureChildren(nodes, childOrder);
  freezeBridgeCaptureSubtree(nodes, childOrder);
  stripWebImportAutoLayout(nodes);
  collapsePassThroughWrappers(nodes, childOrder);
  normalizeWebImportSvgPaths(nodes);
  preserveBridgeCapturedEdgeLayers(nodes);
  stripBridgeButtonBorderEdgeSegments(nodes, childOrder);
  consolidateBridgeCompactControlBorderEdges(nodes, childOrder);
  finalizeBridgeOtpDigitRowChrome(nodes, childOrder);
  stripBridgeCompactInputCaretLayers(nodes, childOrder);
  splitBridgeConsentLinkRuns(nodes, childOrder);
  ensureBridgeCaptureTextVisible(nodes);
  normalizeBridgeCaptureFontWeights(nodes);
  reflowBridgeConsentTcRow(nodes, childOrder);
  separateBridgeFooterConsentFromButton(nodes, childOrder);
  preserveBridgeCaptureTextGeometry(nodes);
  stripBridgeOutlineOnlyControlFills(nodes);
  ensureBridgeCaptureFrameStrokes(nodes, childOrder, opts);
  ensureBridgeSelectedCardInsetStrokes(nodes, opts);
  ensureBridgeOutlinedControlStrokes(nodes, childOrder, opts);
  stripBridgeSpuriousIconButtonStrokes(nodes);
  alignBridgeTextfieldFloatingLabels(nodes, childOrder);
  alignBridgeTextfieldInputValues(nodes, childOrder);
  recoverBridgeOrphanChipLabels(nodes, childOrder);
  recoverBridgeBadgeRowParts(nodes, childOrder);
  clampBridgeInflatedSingleLineText(nodes);
  layoutBridgeBadgeRows(nodes, childOrder);
  organizeBridgeCaptureLayerNames(nodes);
  ensureBridgeCaptureTextVisible(nodes);
  expandBridgeWelcomeBrandFrames(nodes, childOrder);
  recoverBridgeOrphanChipLabels(nodes, childOrder);
  recoverBridgeBadgeRowParts(nodes, childOrder);
  clampBridgeInflatedSingleLineText(nodes);
  layoutBridgeBadgeRows(nodes, childOrder);
  alignBridgeAssuranceHeaderBadges(nodes, childOrder);
  ensureBridgeSigDrawPadChrome(nodes, childOrder, opts);
  expandBridgeIconTextRowFrames(nodes, childOrder);
  ensureBridgeTextOnFilledParent(nodes);
  clampBridgeTextToParentBounds(nodes, columnWidth);
  enforceBridgeCaptureClipping(nodes, childOrder, columnWidth);
  clampBottomNavWidths(nodes, columnWidth);
  clampPhoneShellFrameWidths(nodes, childOrder, columnWidth);
  clampPhoneTopChromeWidths(nodes, columnWidth);
  enforceManualScreenFrames(nodes, childOrder);
  enforceBridgeViewportArtboard(nodes, childOrder);
  expandBridgeSingleLineTextWidths(nodes, columnWidth);
  applyBridgeCaptureCraftTextSemantics(nodes);
  ensureBridgeTextFitsOwnFrame(nodes);
  enforceBridgeCaptureTextFixedResize(nodes);
  clampBridgeTextToParentBounds(nodes, columnWidth);
  prepareBridgeCalloutFrames(nodes, childOrder);
  fitBridgeFooterLinkText(nodes, columnWidth);
  clampBridgeTextToColumnWidth(nodes, columnWidth);
}
