export type PrototypeTrigger = "click" | "hover";
export type PrototypeAction = "navigate" | "open-overlay" | "back";
export type PrototypeTransition = "instant" | "dissolve" | "slide-left" | "slide-right";

export interface PrototypeLink {
  id: string;
  sourceNodeId: string;
  targetFrameId?: string;
  trigger: PrototypeTrigger;
  action: PrototypeAction;
  transition: PrototypeTransition;
}

export function newPrototypeLinkId(): string {
  return `plink-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultPrototypeLink(sourceNodeId: string, targetFrameId?: string): PrototypeLink {
  return {
    id: newPrototypeLinkId(),
    sourceNodeId,
    targetFrameId,
    trigger: "click",
    action: "navigate",
    transition: "instant",
  };
}

type NodeWithLinks = { prototypeLinks?: PrototypeLink[] };

export function collectPrototypeLinks(nodes: Record<string, NodeWithLinks>): PrototypeLink[] {
  const out: PrototypeLink[] = [];
  for (const n of Object.values(nodes)) {
    for (const l of n.prototypeLinks ?? []) {
      out.push(l);
    }
  }
  return out;
}

export function findPrototypeLinkOwner(
  nodes: Record<string, NodeWithLinks>,
  linkId: string,
): { ownerId: string; index: number } | null {
  for (const [ownerId, n] of Object.entries(nodes)) {
    const arr = n.prototypeLinks ?? [];
    const index = arr.findIndex((l) => l.id === linkId);
    if (index >= 0) return { ownerId, index };
  }
  return null;
}

/** Bezier from (x1,y1) to (x2,y2) with horizontal outward control points */
export function prototypeConnectorPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
  const cx1 = x1 + dx;
  const cy1 = y1;
  const cx2 = x2 - dx;
  const cy2 = y2;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}
