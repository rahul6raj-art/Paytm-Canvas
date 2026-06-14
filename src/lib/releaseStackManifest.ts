/** Offline integration stack runner (see verify:stack). */
export const STACK_VERIFY_SCRIPT = "scripts/verify-stack.mjs";

export const RELEASE_VERIFY_SCRIPT = "scripts/verify-release.mjs";

/** npm scripts invoked by verify:stack — keep in sync with scripts/verify-stack.mjs */
export const STACK_VERIFY_SCRIPTS = [
  "verify:persistence",
  "verify:remote",
  "verify:deploy",
  "verify:production",
  "verify:canvas-chrome",
  "verify:legacy-cleanup",
  "verify:ci-gate",
  "verify:api-contracts",
  "verify:tracks-sync",
  "verify:editor-gate",
  "verify:stack-live-gate",
  "verify:migration-gate",
  "verify:docker-stack-gate",
  "verify:stack:live:contract",
  "verify:tracks",
  "verify:release-stack-gate",
] as const;

export const RELEASE_VERIFY_MARKERS = ["verify:stack", "verify:migration"] as const;
