/** Figma-compatible gradient model (normalized handle space 0–1). */

export type GradientKind = "linear" | "radial" | "angular" | "diamond";

export type FillType = "solid" | "gradient" | "image" | "video" | "pattern";

export type GradientHandle = { x: number; y: number };

/** [start (t=0), end (t=1), width/control] — Figma `gradientHandlePositions`. */
export type GradientHandles = [GradientHandle, GradientHandle, GradientHandle];

export interface GradientStop {
  id: string;
  color: string;
  opacity?: number;
  /** 0–100 along the gradient axis */
  position: number;
}

export interface GradientTransform {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
}

export interface FillGradient {
  kind: GradientKind;
  transform: GradientTransform;
  stops: GradientStop[];
  handles: GradientHandles;
}

/** Legacy persisted shape (angle-only linear). */
export type LegacyLinearFillGradient = {
  type: "linear";
  angle: number;
  stops: GradientStop[];
};

export type PersistedFillGradient = FillGradient | LegacyLinearFillGradient;

export type FillPaintNode = {
  fill?: string;
  fillOpacity?: number;
  fillEnabled?: boolean;
  fillType?: FillType;
  fillGradient?: FillGradient;
  fillImageAssetId?: string;
  fillVideoAssetId?: string;
  fillPatternAssetId?: string;
  imageFitMode?: "fill" | "fit" | "crop";
};

export type StrokePaintNode = {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  strokeType?: FillType;
  strokeGradient?: FillGradient;
  strokeImageAssetId?: string;
  strokeVideoAssetId?: string;
  imageFitMode?: "fill" | "fit" | "crop";
};
