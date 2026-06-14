import { buildMaskClipPathForGroup } from "@/lib/mask/buildExactMaskPath";
import { logMaskDiagnostic } from "@/lib/mask/maskDiagnostics";
import type { MaskClipPathResult } from "@/lib/mask/types";
import { svgSafeId } from "@/lib/svgMarkupCore";
import type { EditorNode } from "@/stores/useEditorStore";

export type OutlineMaskRenderInput = {
  groupId: string;
  maskId: string;
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  contentMarkup: string;
  idPrefix?: string;
};

export type OutlineMaskRenderResult = {
  defsMarkup: string;
  bodyMarkup: string;
  clipId: string;
  clip: MaskClipPathResult;
};

/** SVG outline mask: exact vector clipPath + clipped content group. */
export function renderOutlineMaskSvg(input: OutlineMaskRenderInput): OutlineMaskRenderResult | null {
  const clip = buildMaskClipPathForGroup(
    input.groupId,
    input.maskId,
    input.nodes,
    input.childOrder,
  );
  if (!clip) return null;

  const safe = svgSafeId(input.groupId);
  const clipId = `${input.idPrefix ?? "pc-mask"}-clip-${safe}`;
  const ruleAttr =
    clip.clipRule === "evenodd" ? ` clip-rule="evenodd"` : ` clip-rule="nonzero"`;
  const escaped = clip.clipD.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  logMaskDiagnostic("outline", {
    groupId: input.groupId,
    maskId: input.maskId,
    clipRule: clip.clipRule,
    pathLen: clip.clipD.length,
  });

  const defsMarkup =
    `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">` +
    `<path d="${escaped}"${ruleAttr}/></clipPath>`;

  const bodyMarkup = `<g clip-path="url(#${clipId})">${input.contentMarkup}</g>`;

  return { defsMarkup, bodyMarkup, clipId, clip };
}
