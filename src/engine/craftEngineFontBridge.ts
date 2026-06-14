import type { EditorNode } from "@/stores/useEditorStore";
import { clearCanonicalTextLayoutCache } from "@/lib/text/canonicalTextLayout";
import type { EditorFontAsset } from "@/lib/documentPersistence";
import { fontAssetBytes } from "@/lib/editorFontAssets";
import { fetchGoogleFontBinary } from "@/lib/fonts/googleFontBinary";
import { matchFontOption, primaryFontName, type FontFamilyOption } from "@/lib/fonts/fontCatalog";
import { fetchInstalledFontBinary, resetInstalledFontFaceCache } from "@/lib/fonts/localFontBinary";
import { findUploadedFontAsset, uploadedFontOptionsFromAssets } from "@/lib/fonts/uploadedFonts";

const EMBEDDED_NATIVE_FAMILIES = new Set(["inter", "roboto"]);

const registered = new Set<string>();
const pending = new Map<string, Promise<void>>();

export type RuntimeFontSource = "google" | "installed" | "uploaded";

export type RuntimeFontRequest = {
  family: string;
  weight: number;
  source: RuntimeFontSource;
};

function registrationKey(family: string, weight: number, source: RuntimeFontSource): string {
  return `${source}|${family.trim().toLowerCase()}|${weight}`;
}

function isEmbeddedNativeFamily(primary: string): boolean {
  const lower = primary.trim().toLowerCase();
  return EMBEDDED_NATIVE_FAMILIES.has(lower) || lower.includes("inter") || lower.includes("roboto");
}

function weightsForTextNode(fontWeight: number | undefined): Set<number> {
  const weights = new Set<number>([400, 700]);
  const w = fontWeight ?? 500;
  if (w >= 600) {
    weights.add(700);
  } else {
    weights.add(400);
  }
  return weights;
}

function catalogForMatch(
  fontAssets?: Record<string, EditorFontAsset>,
  catalog?: FontFamilyOption[],
): FontFamilyOption[] | undefined {
  if (catalog) return catalog;
  if (fontAssets && Object.keys(fontAssets).length > 0) {
    return uploadedFontOptionsFromAssets(fontAssets);
  }
  return undefined;
}

/** Collect runtime font families + weights referenced by text nodes. */
export function collectRuntimeFontRequests(
  nodes: Record<string, EditorNode>,
  fontAssets?: Record<string, EditorFontAsset>,
  catalog?: FontFamilyOption[],
): RuntimeFontRequest[] {
  const byKey = new Map<string, RuntimeFontRequest>();
  const matchCatalog = catalogForMatch(fontAssets, catalog);

  for (const node of Object.values(nodes)) {
    if (node.type !== "text") continue;
    const stack = node.fontFamily ?? "Inter, system-ui, sans-serif";
    const primary = primaryFontName(stack);
    if (!primary || isEmbeddedNativeFamily(primary)) continue;

    const match = matchFontOption(stack, matchCatalog);
    if (!match || (match.source !== "google" && match.source !== "installed" && match.source !== "uploaded")) {
      continue;
    }

    const weights = weightsForTextNode(node.fontWeight);
    for (const weight of weights) {
      const key = registrationKey(primary, weight, match.source);
      if (!byKey.has(key)) {
        byKey.set(key, { family: primary, weight, source: match.source });
      }
    }
  }

  return [...byKey.values()];
}

export function resetCraftEngineFontUploads(): void {
  registered.clear();
  pending.clear();
  resetInstalledFontFaceCache();
}

async function bytesForRequest(
  request: RuntimeFontRequest,
  fontAssets?: Record<string, EditorFontAsset>,
): Promise<Uint8Array> {
  if (request.source === "google") {
    return fetchGoogleFontBinary(request.family, request.weight);
  }
  if (request.source === "installed") {
    return fetchInstalledFontBinary(request.family, request.weight);
  }
  const asset = findUploadedFontAsset(fontAssets ?? {}, request.family, request.weight);
  if (!asset) {
    throw new Error(`Uploaded font not found: ${request.family}`);
  }
  return fontAssetBytes(asset);
}

async function registerOne(
  engine: CraftEngineInstance,
  request: RuntimeFontRequest,
  fontAssets?: Record<string, EditorFontAsset>,
): Promise<void> {
  const key = registrationKey(request.family, request.weight, request.source);
  if (registered.has(key)) return;

  const existing = pending.get(key);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const bytes = await bytesForRequest(request, fontAssets);
    engine.registerFontFamily(request.family, request.weight, bytes);
    registered.add(key);
  })().finally(() => {
    pending.delete(key);
  });

  pending.set(key, task);
  await task;
}

/** Upload Google, installed, and uploaded font binaries referenced by the scene into WASM. */
export async function syncCraftEngineTextFonts(
  engine: CraftEngineInstance,
  nodes: Record<string, EditorNode>,
  fontAssets?: Record<string, EditorFontAsset>,
  catalog?: FontFamilyOption[],
): Promise<void> {
  const requests = collectRuntimeFontRequests(nodes, fontAssets, catalog);
  if (requests.length === 0) return;

  await Promise.all(requests.map((request) => registerOne(engine, request, fontAssets)));
  clearCanonicalTextLayoutCache();
}
