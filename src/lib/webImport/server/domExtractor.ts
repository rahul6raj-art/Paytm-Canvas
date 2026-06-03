import type { DomSnapshotNode } from "@/lib/webImport/types";

/** Runs inside Playwright page context. */
export function extractDomTreeInBrowser(): DomSnapshotNode {
  const SKIP = new Set([
    "script",
    "style",
    "meta",
    "link",
    "noscript",
    "head",
    "template",
  ]);

  let seq = 0;
  const nextId = () => `dom-${++seq}`;

  type Raw = DomSnapshotNode;

  function stylesOf(el: Element): Raw["styles"] {
    const cs = window.getComputedStyle(el);
    return {
      display: cs.display,
      position: cs.position,
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      border: cs.border,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      opacity: cs.opacity,
      objectFit: cs.objectFit,
      flexDirection: cs.flexDirection,
      gap: cs.gap,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
    };
  }

  function rectOf(el: Element): Raw["rect"] {
    const r = el.getBoundingClientRect();
    return {
      x: r.x + window.scrollX,
      y: r.y + window.scrollY,
      width: r.width,
      height: r.height,
    };
  }

  function leafText(el: Element): string | undefined {
    const tag = el.tagName.toLowerCase();
    if (["input", "textarea"].includes(tag)) {
      const inp = el as HTMLInputElement;
      return inp.value || inp.placeholder || undefined;
    }
    const direct = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (direct) return direct.slice(0, 4000);
    if (el.children.length === 0) {
      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 4000) : undefined;
    }
    return undefined;
  }

  function walk(el: Element, depth: number): Raw | null {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return null;

    const rect = rectOf(el);
    if (rect.width < 1 || rect.height < 1) {
      const kids: Raw[] = [];
      for (const child of Array.from(el.children)) {
        const w = walk(child, depth + 1);
        if (w) kids.push(w);
      }
      if (kids.length === 0) return null;
      return {
        id: nextId(),
        tagName: tag,
        rect,
        styles: stylesOf(el),
        children: kids,
      };
    }

    const children: Raw[] = [];
    for (const child of Array.from(el.children)) {
      const w = walk(child, depth + 1);
      if (w) children.push(w);
    }

    const rawClass = (el as HTMLElement).className;
    const className =
      typeof rawClass === "string" && rawClass.trim()
        ? rawClass.trim().replace(/\s+/g, " ").slice(0, 512)
        : undefined;

    const text = leafText(el);
    const img = tag === "img" ? (el as HTMLImageElement).src : undefined;
    const href = tag === "a" ? (el as HTMLAnchorElement).href : undefined;
    const svgMarkup = tag === "svg" ? (el as SVGElement).outerHTML.slice(0, 8000) : undefined;

    return {
      id: nextId(),
      tagName: tag,
      className,
      text,
      href,
      src: img,
      svgMarkup,
      placeholder: (el as HTMLInputElement).placeholder,
      inputValue: (el as HTMLInputElement).value,
      ariaLabel: el.getAttribute("aria-label") ?? undefined,
      rect,
      styles: stylesOf(el),
      children,
    };
  }

  const body = document.body;
  const rootEl = body ?? document.documentElement;
  const tree =
    walk(rootEl, 0) ?? {
      id: nextId(),
      tagName: "body",
      rect: { x: 0, y: 0, width: window.innerWidth, height: document.documentElement.scrollHeight },
      styles: {},
      children: [],
    };

  return tree;
}
