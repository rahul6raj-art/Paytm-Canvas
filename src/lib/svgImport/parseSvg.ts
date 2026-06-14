import { parse as parseNodeHtml, HTMLElement as NodeHtmlElement } from "node-html-parser";

export type SvgElement = {
  tagLower: string;
  getAttr(name: string): string | undefined;
  childElements(): SvgElement[];
  directText(): string;
};

function adaptDomElement(el: Element): SvgElement {
  return {
    tagLower: el.tagName.toLowerCase(),
    getAttr: (name) => el.getAttribute(name) ?? undefined,
    childElements: () => Array.from(el.children).map(adaptDomElement),
    directText: () => {
      let text = "";
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) text += n.textContent ?? "";
      }
      return text.replace(/\s+/g, " ").trim();
    },
  };
}

function adaptNodeElement(el: NodeHtmlElement): SvgElement {
  return {
    tagLower: el.tagName.toLowerCase(),
    getAttr: (name) => el.getAttribute(name) ?? undefined,
    childElements: () =>
      el.childNodes
        .filter((n): n is NodeHtmlElement => n instanceof NodeHtmlElement)
        .map(adaptNodeElement),
    directText: () => {
      let text = "";
      for (const n of el.childNodes) {
        if (n.nodeType === 3) text += n.text ?? "";
      }
      return text.replace(/\s+/g, " ").trim();
    },
  };
}

/** Parse SVG XML text into a root `<svg>` element tree. */
export function parseSvg(source: string): SvgElement | null {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(source, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") return null;
    return adaptDomElement(root);
  }
  const parsed = parseNodeHtml(source, { lowerCaseTagName: false });
  const svg = parsed.querySelector("svg");
  return svg ? adaptNodeElement(svg) : null;
}
