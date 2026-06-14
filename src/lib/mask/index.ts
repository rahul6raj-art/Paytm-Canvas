export * from "@/lib/mask/types";
export * from "@/lib/mask/isMaskGroup";
export * from "@/lib/mask/buildExactMaskPath";
export * from "@/lib/mask/resolveMaskMode";
export * from "@/lib/mask/renderOutlineMask";
export * from "@/lib/mask/renderAlphaMask";
export * from "@/lib/mask/renderMaskLayer";
export * from "@/lib/mask/renderMaskGroup";
export * from "@/lib/mask/maskHitTesting";
export * from "@/lib/mask/maskSerialization";
export * from "@/lib/mask/maskExport";
export * from "@/lib/mask/maskDiagnostics";

/** @deprecated Use buildMaskClipPathForGroup */
export { buildMaskClipPathForGroup as buildMaskClipPathDForGroup } from "@/lib/mask/buildExactMaskPath";
