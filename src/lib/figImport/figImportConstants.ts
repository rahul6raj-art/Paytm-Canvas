/** Client fetch timeout for POST /api/import-figma (server maxDuration is 60s). */
export const FIGMA_API_IMPORT_TIMEOUT_MS = 90_000;

/** Full-screen import overlay watchdog (covers .fig parse + apply). */
export const FIG_IMPORT_OVERLAY_WATCHDOG_MS = 180_000;

/** Skip idle auto-layout reflow above this — .fig nodes already carry Figma positions. */
export const FIG_IMPORT_POST_LAYOUT_NODE_CAP = 600;

/** Skip automatic browser save after import above this (still editable; use File → Export). */
export const FIG_IMPORT_AUTO_SAVE_NODE_CAP = 2_500;

/** Worker convert timeout before falling back to main-thread import. */
export const FIG_IMPORT_WORKER_TIMEOUT_MS = 120_000;

/** Cooperative yield interval when async import walk is used (rare fallback). */
export const FIG_IMPORT_YIELD_EVERY_NODES = 512;

/** Defer layers panel full tree until after canvas first paint (node count). */
export const FIG_IMPORT_DEFER_LAYERS_PANEL_NODE_CAP = 120;
