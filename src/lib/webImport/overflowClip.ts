/** Map CSS overflow to frame clipChildren for web import. */
export function overflowImpliesClip(overflow: string | undefined): boolean {
  const o = (overflow ?? "").toLowerCase();
  return o === "hidden" || o === "clip" || o === "scroll" || o === "auto";
}
