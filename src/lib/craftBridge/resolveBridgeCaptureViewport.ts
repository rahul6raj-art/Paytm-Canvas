import {
  PML_PHONE_VIEWPORT,
  PML_PHONE_VIEWPORT_HEIGHT,
} from "@/lib/craftBridge/pmlScreenMetrics";
import { previewUrlImpliesPhoneCapture } from "@/lib/craftBridge/bridgeCaptureContext";

export type BridgeCaptureViewportInput = {
  width?: number;
  height?: number;
};

export type BridgeCaptureViewport = {
  width: number;
  height: number;
  /** True when capture targets a phone-column shell (PML-style). */
  phoneCapture: boolean;
};

const GENERIC_CAPTURE_VIEWPORT = { width: 1280, height: 800 } as const;

function clampViewportDimension(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Resolve Playwright viewport for bridge push — client size when provided, else URL-aware default. */
export function resolveBridgeCaptureViewport(
  input?: BridgeCaptureViewportInput,
  previewUrl?: string | null,
): BridgeCaptureViewport {
  // Phone-routed previews must always capture at the design column — never the desktop browser window.
  if (previewUrlImpliesPhoneCapture(previewUrl)) {
    return {
      width: PML_PHONE_VIEWPORT.width,
      height: PML_PHONE_VIEWPORT.height,
      phoneCapture: true,
    };
  }

  if (input && (input.width != null || input.height != null)) {
    const width = clampViewportDimension(input.width, 320, 4096, PML_PHONE_VIEWPORT.width);
    const height = clampViewportDimension(input.height, 480, 4096, PML_PHONE_VIEWPORT_HEIGHT);
    return {
      width,
      height,
      phoneCapture: width <= 420,
    };
  }

  return {
    width: GENERIC_CAPTURE_VIEWPORT.width,
    height: GENERIC_CAPTURE_VIEWPORT.height,
    phoneCapture: false,
  };
}
