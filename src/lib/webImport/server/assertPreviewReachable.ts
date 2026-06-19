/** Fail fast when the Vite/React preview is not running before Playwright capture. */
export async function assertPreviewReachable(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("Preview URL is missing.");
  }

  try {
    const res = await fetch(trimmed, {
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Preview returned HTTP ${res.status}`);
    }
  } catch (e) {
    const base = trimmed.split("?")[0] ?? trimmed;
    const hint =
      e instanceof Error && e.message.includes("HTTP")
        ? e.message
        : "Connection refused or timed out";
    throw new Error(
      `${hint}. Start the app preview first (e.g. \`npm run dev\` in your PML repo), then push again. URL: ${base}`,
    );
  }
}
