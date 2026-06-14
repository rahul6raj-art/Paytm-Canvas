/** Legacy UA — Google Fonts CSS serves TTF/OTF instead of WOFF2. */
const GOOGLE_FONTS_LEGACY_UA =
  "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)";

function encodeGoogleFamily(family: string): string {
  return encodeURIComponent(family).replace(/%20/g, "+");
}

/** Extract font file URLs from a Google Fonts CSS response. */
export function parseGoogleFontCssUrls(css: string): string[] {
  return [...css.matchAll(/url\(([^)]+)\)/g)].map((m) =>
    m[1]!.replace(/['"]/g, "").trim(),
  );
}

function pickTruetypeUrl(urls: string[]): string | undefined {
  return (
    urls.find((u) => /\.ttf($|\?)/i.test(u)) ??
    urls.find((u) => /\.otf($|\?)/i.test(u)) ??
    urls[0]
  );
}

export function googleFontCssUrl(family: string, weight: number): string {
  const encoded = encodeGoogleFamily(family);
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weight}&display=swap`;
}

/** Fetch TTF/OTF bytes for a Google Fonts family + weight. */
export async function fetchGoogleFontBinary(
  family: string,
  weight: number,
): Promise<Uint8Array> {
  const cssUrl = googleFontCssUrl(family, weight);
  const cssRes = await fetch(cssUrl, {
    headers: { "User-Agent": GOOGLE_FONTS_LEGACY_UA },
  });
  if (!cssRes.ok) {
    throw new Error(`Google Fonts CSS failed for ${family} (${cssRes.status})`);
  }
  const css = await cssRes.text();
  const fontUrl = pickTruetypeUrl(parseGoogleFontCssUrls(css));
  if (!fontUrl) {
    throw new Error(`No font URL in Google Fonts CSS for ${family}`);
  }
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) {
    throw new Error(`Font binary failed for ${family} (${fontRes.status})`);
  }
  return new Uint8Array(await fontRes.arrayBuffer());
}
