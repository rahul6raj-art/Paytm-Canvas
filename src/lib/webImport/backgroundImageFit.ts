import type { EditorImageFit } from "@/lib/webImport/types";

/** Map CSS background-size to editor image fit mode. */
export function mapBackgroundSizeToFit(backgroundSize: string | undefined): EditorImageFit {
  const s = (backgroundSize ?? "").toLowerCase().trim();
  if (!s || s === "auto") return "fit";
  if (s === "cover") return "crop";
  if (s === "contain") return "fit";
  if (s === "100% 100%" || s === "100%") return "fill";
  return "crop";
}
