function elementWithContains(target: EventTarget | null): { contains(node: Node): boolean } | null {
  if (
    target != null &&
    typeof (target as HTMLElement).contains === "function"
  ) {
    return target as HTMLElement;
  }
  return null;
}

/** True when the pointer left `currentTarget` (not moving to a descendant). */
export function didPointerExitElement(
  currentTarget: EventTarget | null,
  relatedTarget: EventTarget | null,
): boolean {
  const el = elementWithContains(currentTarget);
  if (!el) return true;
  if (relatedTarget == null) return true;
  if (!isDomNode(relatedTarget)) return true;
  return !el.contains(relatedTarget);
}

function isDomNode(target: EventTarget): target is Node {
  if (typeof Node !== "undefined" && target instanceof Node) return true;
  const nodeType = (target as { nodeType?: unknown }).nodeType;
  return typeof nodeType === "number" && nodeType >= 1;
}
