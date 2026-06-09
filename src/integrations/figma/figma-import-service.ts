import { getFile, getFigmaImageUrls, FigmaApiError } from "@/integrations/figma/figma-api";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  collectFigmaImageRefs,
  embedFigmaImageUrls,
} from "@/integrations/figma/figma-image-parser";
import { convertFigmaApiToPaytmCraft } from "@/integrations/figma/figma-node-parser";
import { getFigmaServerAccessToken } from "@/integrations/figma/figma-server-env";
import type { FigmaApiImportResult, ImportFigmaApiRequest } from "@/integrations/figma/types";
import type { PaytmCraftDocument } from "@/lib/documentPersistence";

export function resolveFigmaAccessToken(requestToken?: string): string {
  const fromRequest = requestToken?.trim();
  if (fromRequest) return fromRequest;
  const fromEnv = getFigmaServerAccessToken();
  if (fromEnv) return fromEnv;
  throw new FigmaApiError(
    "Figma access token is required. Set FIGMA_ACCESS_TOKEN on the server or provide a personal access token.",
  );
}

export type FigmaImportServiceOptions = ImportFigmaApiRequest & {
  /** When true (default on server), embed image bytes as data URLs. */
  embedImages?: boolean;
};

/**
 * Full REST import: fetch file → resolve images → convert to PaytmCraftDocument.
 */
export async function importFigmaFromRestApi(
  opts: FigmaImportServiceOptions,
): Promise<FigmaApiImportResult> {
  const token = resolveFigmaAccessToken(opts.accessToken);

  const fetched = await getFile({
    accessToken: token,
    url: opts.url,
    fileKey: opts.fileKey,
    nodeId: opts.nodeId,
  });

  const imageRefs = new Set<string>();
  collectFigmaImageRefs(fetched.root, imageRefs);

  let imageUrlByRef = await getFigmaImageUrls(fetched.fileKey, [...imageRefs], token);

  const shouldEmbed =
    opts.embedImages !== false &&
    typeof window === "undefined" &&
    imageRefs.size > 0 &&
    imageRefs.size <= 40;
  if (shouldEmbed) {
    imageUrlByRef = await embedFigmaImageUrls(imageUrlByRef);
  }

  const result = convertFigmaApiToPaytmCraft(fetched.root, fetched.fileName, imageUrlByRef);
  if (!result.ok) return result;

  const roots = result.document.childOrder[EDITOR_ROOT_KEY] ?? [];
  const nodeCount = Object.keys(result.document.nodes).length;
  if (roots.length === 0 || nodeCount === 0) {
    return {
      ok: false,
      error:
        "Figma returned no importable layers for this link. In Figma, select the frame, press ⌘L (Copy link), and paste that URL.",
    };
  }

  return result;
}

export async function importFigmaDocumentFromRestApi(
  opts: FigmaImportServiceOptions,
): Promise<PaytmCraftDocument> {
  const result = await importFigmaFromRestApi(opts);
  if (!result.ok) throw new FigmaApiError(result.error);
  return result.document;
}
