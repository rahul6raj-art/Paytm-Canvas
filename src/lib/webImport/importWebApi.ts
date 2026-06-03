import type { ImportWebRequest, ImportWebResponse } from "@/lib/webImport/types";

export type ImportWebStep =
  | "launching"
  | "loading"
  | "screenshot"
  | "extracting"
  | "converting"
  | "building";

export const IMPORT_WEB_STEPS: { id: ImportWebStep; label: string }[] = [
  { id: "launching", label: "Launching browser" },
  { id: "loading", label: "Loading website" },
  { id: "screenshot", label: "Capturing screenshot" },
  { id: "extracting", label: "Extracting layout" },
  { id: "converting", label: "Converting elements" },
  { id: "building", label: "Building canvas" },
];

const PROGRESS_STEPS_DURING_FETCH: ImportWebStep[] = [
  "loading",
  "screenshot",
  "extracting",
  "converting",
];

export async function importWebFromApi(
  request: ImportWebRequest,
  onStep?: (step: ImportWebStep) => void,
): Promise<ImportWebResponse> {
  onStep?.("launching");

  let progressIdx = 0;
  const progressTimer =
    onStep &&
    setInterval(() => {
      onStep(PROGRESS_STEPS_DURING_FETCH[progressIdx % PROGRESS_STEPS_DURING_FETCH.length]);
      progressIdx += 1;
    }, 10_000);

  try {
    onStep?.("loading");
    const res = await fetch("/api/import-web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const json = (await res.json()) as ImportWebResponse | { error: string };
    if (!res.ok) {
      const err = "error" in json ? json.error : `Import failed (${res.status})`;
      throw new Error(err);
    }

    onStep?.("building");
    return json as ImportWebResponse;
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
}
