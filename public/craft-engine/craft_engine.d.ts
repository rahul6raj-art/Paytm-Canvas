/* tslint:disable */
/* eslint-disable */

export class CraftEngine {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    applyDocumentOp(json: string): void;
    applyDocumentOps(json: string): void;
    atlasImageCount(): number;
    backendLabel(): string;
    canRedo(): boolean;
    canUndo(): boolean;
    clearHistory(): void;
    static create(canvas: HTMLCanvasElement): Promise<CraftEngine>;
    hitTest(world_x: number, world_y: number): string | undefined;
    /**
     * Canonical rustybuzz/fontdue text layout for editor, SVG, caret, and hit-test.
     */
    layoutTextNode(json: string): string;
    loadDocument(json: string): void;
    pushHistorySnapshot(): void;
    redo(): void;
    /**
     * Register a runtime TTF/OTF face for text rendering (from Google Fonts bridge).
     */
    registerFontFamily(family_name: string, weight: number, ttf_bytes: Uint8Array): void;
    registerImageAsset(asset_id: string, width: number, height: number, rgba: Uint8Array): void;
    render(): void;
    resize(css_width: number, css_height: number, dpr: number): void;
    setViewport(pan_x: number, pan_y: number, zoom: number): void;
    snapshotDocument(): string | undefined;
    /**
     * Replace WASM document without recording undo (TS store is source of truth).
     */
    syncDocument(json: string): void;
    tileCacheLen(): number;
    undo(): void;
}

export function engine_version(): string;

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_craftengine_free: (a: number, b: number) => void;
    readonly craftengine_applyDocumentOp: (a: number, b: number, c: number) => [number, number];
    readonly craftengine_applyDocumentOps: (a: number, b: number, c: number) => [number, number];
    readonly craftengine_atlasImageCount: (a: number) => number;
    readonly craftengine_backendLabel: (a: number) => [number, number];
    readonly craftengine_canRedo: (a: number) => number;
    readonly craftengine_canUndo: (a: number) => number;
    readonly craftengine_clearHistory: (a: number) => void;
    readonly craftengine_create: (a: any) => any;
    readonly craftengine_hitTest: (a: number, b: number, c: number) => [number, number];
    readonly craftengine_layoutTextNode: (a: number, b: number, c: number) => [number, number, number, number];
    readonly craftengine_loadDocument: (a: number, b: number, c: number) => [number, number];
    readonly craftengine_pushHistorySnapshot: (a: number) => [number, number];
    readonly craftengine_redo: (a: number) => [number, number];
    readonly craftengine_registerFontFamily: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly craftengine_registerImageAsset: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly craftengine_render: (a: number) => [number, number];
    readonly craftengine_resize: (a: number, b: number, c: number, d: number) => void;
    readonly craftengine_setViewport: (a: number, b: number, c: number, d: number) => void;
    readonly craftengine_snapshotDocument: (a: number) => [number, number];
    readonly craftengine_syncDocument: (a: number, b: number, c: number) => [number, number];
    readonly craftengine_tileCacheLen: (a: number) => number;
    readonly craftengine_undo: (a: number) => [number, number];
    readonly engine_version: () => [number, number];
    readonly init_panic_hook: () => void;
    readonly wasm_bindgen__convert__closures_____invoke__h9c64e57416b714de: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h897d89226e528b54: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
