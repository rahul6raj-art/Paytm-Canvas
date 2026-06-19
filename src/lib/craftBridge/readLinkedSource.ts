import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

export type ReadSourceResponse = {
  content: string;
  hash: string;
  mtime: string;
  absolutePath: string;
};

export async function fetchLinkedSourceContent(
  link: CodeRoundTripLink,
): Promise<ReadSourceResponse | { ok: false; error: string }> {
  const params = new URLSearchParams({
    repoRoot: link.repoRoot,
    sourcePath: link.sourcePath,
  });
  const res = await bridgeFetch(`/api/craft-bridge/read-source?${params}`);
  const body = (await res.json()) as ReadSourceResponse | { error: string };
  if (!res.ok) {
    return { ok: false, error: "error" in body ? body.error : `Read failed (${res.status})` };
  }
  if (!("content" in body) || !("hash" in body)) {
    return { ok: false, error: "Invalid read-source response." };
  }
  return body;
}

export async function fetchLinkedCompanionCss(link: CodeRoundTripLink): Promise<string[]> {
  const paths = (link.cssPaths ?? []).filter((p) => p?.trim());
  const texts: string[] = [];
  for (const cssPath of paths) {
    const params = new URLSearchParams({
      repoRoot: link.repoRoot,
      sourcePath: cssPath,
    });
    const res = await bridgeFetch(`/api/craft-bridge/read-source?${params}`);
    if (!res.ok) continue;
    const body = (await res.json()) as ReadSourceResponse;
    if (body.content?.trim()) texts.push(body.content);
  }
  return texts;
}
