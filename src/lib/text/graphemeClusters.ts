let graphemeSegmenter: Intl.Segmenter | null | undefined;

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter !== undefined) return graphemeSegmenter;
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    graphemeSegmenter = null;
    return null;
  }
  try {
    graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  } catch {
    graphemeSegmenter = null;
  }
  return graphemeSegmenter;
}

/** Split text into user-perceived grapheme clusters (emoji-safe). */
export function segmentGraphemes(text: string): string[] {
  const segmenter = getGraphemeSegmenter();
  if (!segmenter) return [...text];
  return [...segmenter.segment(text)].map((part) => part.segment);
}

/** Map a string index to grapheme cluster index. */
export function graphemeIndexAtCodeUnitIndex(text: string, codeUnitIndex: number): number {
  const clusters = segmentGraphemes(text);
  let offset = 0;
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i]!;
    const next = offset + cluster.length;
    if (codeUnitIndex <= next) return i;
    offset = next;
  }
  return clusters.length;
}
