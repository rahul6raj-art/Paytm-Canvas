import type {
  BridgeParityPixelReport,
  BridgeParityReport,
} from "@/lib/craftBridge/bridgeParityTypes";

export type RgbaBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const DEFAULT_THRESHOLD = 8;

/** Compare two RGBA buffers of equal size; returns pixel diff stats. */
export function diffRgbaBuffers(
  reference: RgbaBuffer,
  actual: RgbaBuffer,
  threshold = DEFAULT_THRESHOLD,
): BridgeParityPixelReport {
  if (reference.width !== actual.width || reference.height !== actual.height) {
    throw new Error(
      `Buffer size mismatch: ${reference.width}x${reference.height} vs ${actual.width}x${actual.height}`,
    );
  }
  const { width, height, data: a } = actual;
  const b = reference.data;
  const totalPixels = width * height;
  let diffPixels = 0;
  let deltaSum = 0;

  for (let i = 0; i < totalPixels; i++) {
    const o = i * 4;
    const dr = Math.abs(a[o]! - b[o]!);
    const dg = Math.abs(a[o + 1]! - b[o + 1]!);
    const db = Math.abs(a[o + 2]! - b[o + 2]!);
    const da = Math.abs(a[o + 3]! - b[o + 3]!);
    const max = Math.max(dr, dg, db, da);
    if (max > threshold) {
      diffPixels++;
      deltaSum += (dr + dg + db + da) / 4;
    }
  }

  return {
    width,
    height,
    totalPixels,
    diffPixels,
    diffPercent: totalPixels > 0 ? (diffPixels / totalPixels) * 100 : 0,
    meanDelta: diffPixels > 0 ? deltaSum / diffPixels : 0,
  };
}

export function pixelReportToScore(report: BridgeParityPixelReport): number {
  return Math.max(0, Math.round(100 - report.diffPercent * 4));
}

export function buildBridgeParityReport(input: {
  screenLabel: string;
  previewUrl: string;
  pixel?: BridgeParityPixelReport;
}): BridgeParityReport {
  const score = input.pixel ? pixelReportToScore(input.pixel) : 0;
  return {
    screenLabel: input.screenLabel,
    previewUrl: input.previewUrl,
    score,
    pixel: input.pixel,
    mismatches: [],
  };
}

/** Decode PNG/JPEG data URL to RGBA via Canvas (browser or node-canvas). */
export async function decodeDataUrlToRgba(
  dataUrl: string,
  canvasFactory: () => {
    width: number;
    height: number;
    getContext(type: "2d"): {
      drawImage(img: { width: number; height: number }, x: number, y: number): void;
      getImageData(x: number, y: number, w: number, h: number): ImageData;
    } | null;
  },
  imageFactory: () => {
    onload: (() => void) | null;
    onerror: (() => void) | null;
    src: string;
    width: number;
    height: number;
  },
): Promise<RgbaBuffer> {
  return new Promise((resolve, reject) => {
    const img = imageFactory();
    img.onload = () => {
      const canvas = canvasFactory();
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2d context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      resolve({
        width: img.width,
        height: img.height,
        data: imageData.data,
      });
    };
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}
