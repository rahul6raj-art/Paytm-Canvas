/** Scene payload passed to the WASM craft-engine (subset of editor document). */
export type CraftEngineAssetSummary = {
  width: number;
  height: number;
  averageColor?: string;
  mimeType?: string;
};

export type CraftEngineDocument = {
  rootIds: string[];
  nodes: Record<string, unknown>;
  childOrder: Record<string, string[]>;
  assets?: Record<string, CraftEngineAssetSummary>;
};

export type CraftEngineWasm = {
  CraftEngine: {
    create(canvas: HTMLCanvasElement): Promise<CraftEngineInstance>;
  };
  engineVersion?: () => string;
  default: (wasmUrl?: string | URL | RequestInfo) => Promise<unknown>;
};

export type CraftEngineInstance = {
  backendLabel(): string;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  setViewport(panX: number, panY: number, zoom: number): void;
  loadDocument(json: string): void;
  /** Replace document without WASM undo snapshot (editor store sync). */
  syncDocument(json: string): void;
  /** Opt-in snapshot before WASM-authoritative edits. */
  pushHistorySnapshot(): void;
  render(): void;
  /** Deepest paintable node at world coordinates (WASM hit test). */
  hitTest(worldX: number, worldY: number): string | undefined;
  /** Cached tile count after last document sync. */
  tileCacheLen(): number;
  /** Images packed in the GPU texture atlas. */
  atlasImageCount(): number;
  /** Apply incremental document op in WASM (move, update, delete, insert). */
  applyDocumentOp(json: string): void;
  /** Apply multiple document ops in one WASM round-trip. */
  applyDocumentOps(json: string): void;
  /** Clear WASM undo/redo stack. */
  clearHistory(): void;
  /** Serialize current WASM document snapshot. */
  snapshotDocument(): string | undefined;
  /** Upload RGBA8 pixels for GPU textured image draw. */
  registerImageAsset(
    assetId: string,
    width: number,
    height: number,
    rgba: Uint8Array,
  ): void;
  /** Register a runtime TTF/OTF face for native text rendering. */
  registerFontFamily(familyName: string, weight: number, ttfBytes: Uint8Array): void;
  /** Canonical rustybuzz/fontdue text layout JSON for editor + SVG + caret. */
  layoutTextNode(json: string): string;
  /** WASM-side undo stack (document snapshots). */
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
};
