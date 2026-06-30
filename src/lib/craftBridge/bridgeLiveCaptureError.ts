/** User-facing error when Playwright live capture fails during bridge push. */
export function bridgeLiveCaptureFailureMessage(error: string, previewUrl: string): string {
  const lines = [
    "Live preview capture failed — Craft needs the running app to import pixel-accurate layers.",
    error.trim(),
    `Preview URL: ${previewUrl}`,
    "Fix: (1) Start your app preview (e.g. npm run dev on port 5173).",
    "(2) In Craft-main run: npm run setup:browsers",
    "(3) Push again while Craft /editor is open.",
  ];
  return lines.filter(Boolean).join("\n");
}
