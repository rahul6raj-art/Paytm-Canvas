"use strict";
var __craftDomExtract = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/webImport/domExtractor.ts
  var domExtractor_exports = {};
  __export(domExtractor_exports, {
    extractDomTreeInBrowser: () => extractDomTreeInBrowser
  });
  function extractDomTreeInBrowser() {
    const SKIP = /* @__PURE__ */ new Set([
      "script",
      "style",
      "meta",
      "link",
      "noscript",
      "head",
      "template"
    ]);
    const TEXT_TAGS = /* @__PURE__ */ new Set([
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "span",
      "label",
      "a",
      "li",
      "button",
      "strong",
      "em",
      "small",
      "figcaption"
    ]);
    let seq = 0;
    const nextId = () => `dom-${++seq}`;
    const PAINT_SELECTOR = "path,rect,circle,ellipse,line,polyline,polygon,text";
    function stylesOf(el, pseudo) {
      const cs = window.getComputedStyle(el, pseudo);
      return {
        display: cs.display,
        position: cs.position,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        backgroundSize: cs.backgroundSize,
        color: cs.color,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textDecoration: cs.textDecorationLine || cs.textDecoration,
        textTransform: cs.textTransform,
        textAlign: cs.textAlign,
        verticalAlign: cs.verticalAlign,
        whiteSpace: cs.whiteSpace,
        border: cs.border,
        borderTopWidth: cs.borderTopWidth,
        borderRightWidth: cs.borderRightWidth,
        borderBottomWidth: cs.borderBottomWidth,
        borderLeftWidth: cs.borderLeftWidth,
        borderTopColor: cs.borderTopColor,
        borderRightColor: cs.borderRightColor,
        borderBottomColor: cs.borderBottomColor,
        borderLeftColor: cs.borderLeftColor,
        borderRadius: cs.borderRadius,
        borderTopLeftRadius: cs.borderTopLeftRadius,
        borderTopRightRadius: cs.borderTopRightRadius,
        borderBottomRightRadius: cs.borderBottomRightRadius,
        borderBottomLeftRadius: cs.borderBottomLeftRadius,
        boxShadow: cs.boxShadow,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        outlineStyle: cs.outlineStyle,
        opacity: cs.opacity,
        mixBlendMode: cs.mixBlendMode,
        filter: cs.filter,
        backdropFilter: cs.backdropFilter,
        transform: cs.transform,
        objectFit: cs.objectFit,
        overflow: cs.overflow,
        width: cs.width,
        height: cs.height,
        minWidth: cs.minWidth,
        maxWidth: cs.maxWidth,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        top: cs.top,
        left: cs.left,
        right: cs.right,
        bottom: cs.bottom,
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        flexGrow: cs.flexGrow,
        flexShrink: cs.flexShrink,
        flexBasis: cs.flexBasis,
        alignSelf: cs.alignSelf,
        order: cs.order,
        gap: cs.gap,
        rowGap: cs.rowGap,
        columnGap: cs.columnGap,
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        alignContent: cs.alignContent,
        gridTemplateColumns: cs.gridTemplateColumns,
        gridTemplateRows: cs.gridTemplateRows,
        gridAutoFlow: cs.gridAutoFlow,
        gridColumn: cs.gridColumn,
        gridRow: cs.gridRow,
        boxSizing: cs.boxSizing,
        zIndex: cs.zIndex
      };
    }
    function rectOf(el) {
      const r = el.getBoundingClientRect();
      return {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height
      };
    }
    function pseudoLayers(el) {
      const out = [];
      for (const kind of ["before", "after"]) {
        const pseudo = `::${kind}`;
        const cs = window.getComputedStyle(el, pseudo);
        const content = cs.content;
        if (!content || content === "none" || content === '""' || content === "normal") continue;
        const text = content.startsWith('"') || content.startsWith("'") ? content.slice(1, -1) : void 0;
        const rect = rectOf(el);
        out.push({
          kind,
          rect: { ...rect, width: Math.max(1, rect.width), height: Math.max(1, rect.height) },
          styles: stylesOf(el, pseudo),
          text
        });
      }
      return out.length ? out : void 0;
    }
    function isVisuallyHiddenFormControl(el) {
      const tag = el.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea") return false;
      const input = el;
      if (input.type === "hidden") return true;
      const cs = window.getComputedStyle(el);
      const w = el.getBoundingClientRect().width;
      const h = el.getBoundingClientRect().height;
      if (w <= 1 && h <= 1) return true;
      const clip = cs.clip ?? "";
      if (/rect\(0(?:px)?,\s*0(?:px)?,\s*0(?:px)?,\s*0(?:px)?\)/i.test(clip)) return true;
      return false;
    }
    function isHiddenElement(el) {
      if (el.hasAttribute("hidden")) return true;
      const cls = (el.className ?? "").toString().toLowerCase();
      if (cls.includes("sr-only") || cls.includes("visually-hidden")) {
        return true;
      }
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") {
        return true;
      }
      const opacity = parseFloat(cs.opacity);
      if (Number.isFinite(opacity) && opacity < 0.05) return true;
      if (parseFloat(cs.fontSize) < 1) return true;
      if (el.getAttribute("aria-hidden") === "true") {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return true;
        return false;
      }
      return false;
    }
    function tryCanvasImgDataUrl(el) {
      const src = el.currentSrc || el.src;
      if (!src) return void 0;
      if (src.startsWith("data:") || src.startsWith("blob:")) return src;
      try {
        const w = el.naturalWidth || el.width;
        const h = el.naturalHeight || el.height;
        if (w < 1 || h < 1) return src;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return src;
        ctx.drawImage(el, 0, 0);
        return canvas.toDataURL("image/png");
      } catch {
        return src;
      }
    }
    function extractBgImageUrl(styles) {
      const bg = styles.backgroundImage ?? "";
      if (!bg || bg === "none" || bg.includes("gradient")) return void 0;
      const m = bg.match(/url\(["']?([^"')]+)["']?\)/i);
      return m?.[1];
    }
    function aggregateControlText(el) {
      const tag = el.tagName.toLowerCase();
      if (!["button", "a"].includes(tag)) return void 0;
      const parts = [];
      const visit = (node) => {
        for (const child of Array.from(node.children)) {
          const ct = child.tagName.toLowerCase();
          if (TEXT_TAGS.has(ct)) {
            const t = leafText(child);
            if (t) parts.push(t);
          } else if (ct !== "svg") {
            visit(child);
          }
        }
      };
      visit(el);
      const joined = parts.join(" ").replace(/\s+/g, " ").trim();
      return joined ? joined.slice(0, 4e3) : void 0;
    }
    function inlineSvgMarkup(el) {
      if (el.tagName.toLowerCase() !== "svg") return void 0;
      const svg = el;
      const liveTargets = svg.querySelectorAll(PAINT_SELECTOR);
      const clone = svg.cloneNode(true);
      const cloneTargets = clone.querySelectorAll(PAINT_SELECTOR);
      const svgColor = window.getComputedStyle(svg).color;
      cloneTargets.forEach((node, i) => {
        const source = liveTargets[i] ?? node;
        const cs = window.getComputedStyle(source);
        const fillAttr = source.getAttribute("fill");
        if (cs.fill && cs.fill !== "none") {
          node.setAttribute("fill", cs.fill);
        } else if (fillAttr === "currentColor" && svgColor) {
          node.setAttribute("fill", svgColor);
        } else if (fillAttr === "none" || cs.fill === "none") {
          node.setAttribute("fill", "none");
        }
        const strokeAttr = source.getAttribute("stroke");
        if (cs.stroke && cs.stroke !== "none") {
          node.setAttribute("stroke", cs.stroke);
          if (cs.strokeWidth) node.setAttribute("stroke-width", cs.strokeWidth);
          if (cs.strokeLinecap && cs.strokeLinecap !== "butt") {
            node.setAttribute("stroke-linecap", cs.strokeLinecap);
          }
          if (cs.strokeLinejoin && cs.strokeLinejoin !== "miter") {
            node.setAttribute("stroke-linejoin", cs.strokeLinejoin);
          }
        } else if (strokeAttr === "currentColor" && svgColor) {
          node.setAttribute("stroke", svgColor);
        } else {
          node.setAttribute("stroke", "none");
          node.removeAttribute("stroke-width");
        }
        const fillRule = source.getAttribute("fill-rule") ?? source.getAttribute("fillRule") ?? cs.getPropertyValue("fill-rule");
        if (fillRule) node.setAttribute("fill-rule", fillRule);
        const clipRule = source.getAttribute("clip-rule") ?? source.getAttribute("clipRule") ?? cs.getPropertyValue("clip-rule");
        if (clipRule) node.setAttribute("clip-rule", clipRule);
        if (cs.opacity && cs.opacity !== "1") {
          node.setAttribute("opacity", cs.opacity);
        }
      });
      return clone.outerHTML.slice(0, 128e3);
    }
    function aggregateNestedText(el) {
      const tag = el.tagName.toLowerCase();
      if (!["label", "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "li"].includes(tag)) {
        return void 0;
      }
      if (el.children.length === 0) return void 0;
      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 4e3) : void 0;
    }
    function leafText(el) {
      const tag = el.tagName.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return void 0;
      if (!TEXT_TAGS.has(tag)) return void 0;
      const direct = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("").replace(/\s+/g, " ").trim();
      if (direct) return direct.slice(0, 4e3);
      if (el.children.length === 0) {
        const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        return t ? t.slice(0, 4e3) : void 0;
      }
      return void 0;
    }
    function hasMixedInlineContent(el) {
      let hasText = false;
      let hasElement = false;
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim()) hasText = true;
        if (child.nodeType === Node.ELEMENT_NODE) hasElement = true;
      }
      return hasText && hasElement;
    }
    function walkChildNodes(el, depth) {
      const tag = el.tagName.toLowerCase();
      if (tag === "svg") return [];
      const splitInlineText = hasMixedInlineContent(el) && (tag === "p" || tag === "span" || tag === "div" || tag === "label");
      const children = [];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (!splitInlineText) continue;
          const raw = (child.textContent ?? "").replace(/\s+/g, " ");
          const trimmed = raw.trim();
          if (!trimmed) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          const textRect = range.getBoundingClientRect();
          if (textRect.width < 0.5 && textRect.height < 0.5) continue;
          children.push({
            id: nextId(),
            tagName: "span",
            text: trimmed,
            rect: {
              x: textRect.x,
              y: textRect.y,
              width: Math.max(1, textRect.width),
              height: Math.max(1, textRect.height)
            },
            styles: stylesOf(el),
            children: []
          });
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const w = walk(child, depth + 1);
        if (w) children.push(w);
      }
      return children;
    }
    function walk(el, depth) {
      const tag = el.tagName.toLowerCase();
      if (SKIP.has(tag)) return null;
      if (isVisuallyHiddenFormControl(el)) return null;
      if (isHiddenElement(el)) return null;
      const rect = rectOf(el);
      if (rect.width < 1 || rect.height < 1) {
        const kids = walkChildNodes(el, depth + 1);
        if (kids.length === 0) return null;
        return {
          id: nextId(),
          tagName: tag,
          rect,
          styles: stylesOf(el),
          children: kids
        };
      }
      const children = walkChildNodes(el, depth);
      const rawClass = el.className;
      const className = typeof rawClass === "string" && rawClass.trim() ? rawClass.trim().replace(/\s+/g, " ").slice(0, 512) : void 0;
      const styles = stylesOf(el);
      const controlText = aggregateControlText(el);
      const nestedText = aggregateNestedText(el);
      const text = leafText(el) ?? controlText ?? nestedText;
      const img = tag === "img" ? tryCanvasImgDataUrl(el) : void 0;
      const href = tag === "a" ? el.href : void 0;
      const svgMarkup = inlineSvgMarkup(el);
      const backgroundImageSrc = extractBgImageUrl(styles);
      return {
        id: nextId(),
        tagName: tag,
        className,
        role: el.getAttribute("role") ?? void 0,
        text,
        href,
        src: img,
        backgroundImageSrc,
        svgMarkup,
        placeholder: el.placeholder,
        inputValue: el.value,
        ariaLabel: el.getAttribute("aria-label") ?? void 0,
        rect,
        styles,
        pseudoElements: pseudoLayers(el),
        children
      };
    }
    const body = document.body;
    const rootEl = body ?? document.documentElement;
    const tree = walk(rootEl, 0) ?? {
      id: nextId(),
      tagName: "body",
      rect: { x: 0, y: 0, width: window.innerWidth, height: document.documentElement.scrollHeight },
      styles: {},
      children: []
    };
    return tree;
  }
  return __toCommonJS(domExtractor_exports);
})();
