import { matchFontOption, primaryFontName } from "./fontCatalog";

const loadedGoogle = new Set<string>();
const loadingGoogle = new Map<string, Promise<void>>();

function googleFontsStylesheetUrl(family: string): string {
  const encoded = encodeURIComponent(family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`;
}

function injectGoogleStylesheet(family: string): Promise<void> {
  const key = family.toLowerCase();
  if (loadedGoogle.has(key)) return Promise.resolve();
  const pending = loadingGoogle.get(key);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const id = `gf-${key.replace(/[^a-z0-9]+/g, "-")}`;
    if (document.getElementById(id)) {
      loadedGoogle.add(key);
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontsStylesheetUrl(family);
    link.onload = () => {
      loadedGoogle.add(key);
      resolve();
    };
    link.onerror = () => reject(new Error(`Failed to load font: ${family}`));
    document.head.appendChild(link);
  }).then(async () => {
    await document.fonts.ready;
  });

  loadingGoogle.set(key, promise);
  return promise.finally(() => loadingGoogle.delete(key));
}

/** Load web or system font so canvas `measureText` / `fillText` use the correct face. */
export async function ensureFontFamilyLoaded(fontFamily: string): Promise<void> {
  const primary = primaryFontName(fontFamily);
  if (!primary || primary === "sans-serif" || primary === "serif" || primary === "monospace") {
    return;
  }

  const match = matchFontOption(fontFamily);
  if (match?.source === "google") {
    await injectGoogleStylesheet(match.primary);
    try {
      await document.fonts.load(`400 16px "${match.primary}"`);
    } catch {
      /* optional */
    }
    return;
  }

  try {
    await document.fonts.load(`400 16px ${fontFamily}`);
  } catch {
    await document.fonts.load(`400 16px "${primary}"`);
  }
}
