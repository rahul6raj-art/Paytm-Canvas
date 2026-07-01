import type { CraftBridgePendingImport } from "@/lib/craftBridge/types";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import {
  resolveBridgeCaptureViewport,
  type BridgeCaptureViewportInput,
} from "@/lib/craftBridge/resolveBridgeCaptureViewport";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";
import type { EditorNode } from "@/stores/useEditorStore";

export type BridgeCaptureViewportMeta = {
  width: number;
  height: number;
  phoneCapture: boolean;
};

/** Virtual capture-only paths — no real repo file for read/write-source. */
export function isPreviewOnlySourcePath(sourcePath?: string | null): boolean {
  return Boolean(sourcePath?.trim().startsWith("preview://"));
}

/** Whether a linked source path can be read/written on disk. */
export function isWritableLinkedSourcePath(sourcePath?: string | null): boolean {
  const trimmed = sourcePath?.trim();
  if (!trimmed) return false;
  return !isPreviewOnlySourcePath(trimmed);
}

export function previewUrlImpliesPhoneCapture(previewUrl?: string | null): boolean {
  const trimmed = previewUrl?.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (parsed.searchParams.has("screen")) return true;
    if (/iframe\.html$/i.test(parsed.pathname)) return false;
    if (parsed.searchParams.has("path")) return false;
    if (parsed.pathname && parsed.pathname !== "/") return false;
  } catch {
    return true;
  }
  return true;
}

export function resolvePendingCaptureViewport(
  pending: Pick<CraftBridgePendingImport, "captureViewport" | "link">,
): BridgeCaptureViewportMeta {
  return resolveBridgeCaptureViewport(
    pending.captureViewport,
    pending.link?.previewUrl,
  );
}

export function resolveApplyCaptureContext(
  pending: Pick<CraftBridgePendingImport, "captureViewport" | "link">,
  nodes: Record<string, EditorNode>,
): {
  columnWidth: number;
  expectPhoneArtboard: boolean;
  requireRoundTripMetadata: boolean;
} {
  const viewport = resolvePendingCaptureViewport(pending);
  const phoneShellOnCanvas = Object.values(nodes).some(
    (n) => n.parentId === null && isPhoneShellClassName(n.codeClassName),
  );
  const phoneCapture =
    viewport.phoneCapture ||
    phoneShellOnCanvas ||
    previewUrlImpliesPhoneCapture(pending.link?.previewUrl);
  const expectPhoneArtboard = phoneCapture;
  const hasRealSource =
    isWritableLinkedSourcePath(pending.link?.sourcePath) &&
    Boolean(pending.sourceHeader?.trim());

  return {
    columnWidth: expectPhoneArtboard ? PML_PHONE_COLUMN_WIDTH : viewport.width,
    expectPhoneArtboard,
    requireRoundTripMetadata: hasRealSource,
  };
}

export function parseCaptureViewportInput(
  raw?: BridgeCaptureViewportInput | null,
): BridgeCaptureViewportInput | undefined {
  if (!raw) return undefined;
  if (raw.width == null && raw.height == null) return undefined;
  return raw;
}
