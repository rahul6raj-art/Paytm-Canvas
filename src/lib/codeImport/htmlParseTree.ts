/**
 * Parse HTML for import — DOMParser in the browser, node-html-parser in Node/tests.
 */

import { parse as parseNodeHtml, HTMLElement as NodeHtmlElement, NodeType } from "node-html-parser";

export interface HtmlImportElement {
  tagLower: string;
  getAttr(name: string): string | undefined;
  childElements(): HtmlImportElement[];
  directText(): string;
  querySelector(selector: string): HtmlImportElement | null;
}

function adaptDomElement(el: Element): HtmlImportElement {
  return {
    tagLower: el.tagName.toLowerCase(),
    getAttr: (name) => el.getAttribute(name) ?? undefined,
    childElements: () => Array.from(el.children).map(adaptDomElement),
    directText: () => {
      let text = "";
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) {
          text += n.textContent ?? "";
        }
      }
      return text.replace(/\s+/g, " ").trim();
    },
    querySelector: (selector) => {
      const hit = el.querySelector(selector);
      return hit ? adaptDomElement(hit) : null;
    },
  };
}

function adaptNodeHtmlElement(el: NodeHtmlElement): HtmlImportElement {
  return {
    tagLower: el.tagName.toLowerCase(),
    getAttr: (name) => el.getAttribute(name) ?? undefined,
    childElements: () =>
      el.childNodes
        .filter((n): n is NodeHtmlElement => n instanceof NodeHtmlElement)
        .map(adaptNodeHtmlElement),
    directText: () => {
      let text = "";
      for (const n of el.childNodes) {
        if (n.nodeType === NodeType.TEXT_NODE) {
          text += n.text ?? "";
        }
      }
      return text.replace(/\s+/g, " ").trim();
    },
    querySelector: (selector) => {
      const hit = el.querySelector(selector);
      return hit ? adaptNodeHtmlElement(hit) : null;
    },
  };
}

export function parseHtmlImportTree(source: string): {
  ok: true;
  root: HtmlImportElement;
} | {
  ok: false;
  error: string;
} {
  try {
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(source, "text/html");
      const body = doc.body;
      if (!body) {
        return { ok: false, error: "Could not parse HTML document body." };
      }
      return { ok: true, root: adaptDomElement(body) };
    }

    const parsed = parseNodeHtml(source, { comment: true });
    const body = parsed.querySelector("body") ?? parsed;
    return { ok: true, root: adaptNodeHtmlElement(body) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not parse HTML: ${msg}` };
  }
}
