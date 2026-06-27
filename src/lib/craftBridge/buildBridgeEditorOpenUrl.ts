/** Open Craft editor and trigger pending bridge import consumption. */
export function buildBridgeEditorOpenUrl(pendingId: string): string {
  const id = pendingId.trim();
  if (!id) return "/editor?bridgeImport=1";
  return `/editor?bridgeImport=1&bridgeId=${encodeURIComponent(id)}`;
}
