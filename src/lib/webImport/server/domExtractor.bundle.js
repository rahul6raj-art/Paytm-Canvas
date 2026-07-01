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

  // src/lib/webImport/bridgeCaptureHairlines.ts
  var MIN_EDGE_PX = 0.5;
  function parseEdgeWidth(value) {
    if (!value) return 0;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  function isVisibleCssColor(color) {
    if (!color?.trim()) return false;
    const c = color.trim().toLowerCase();
    return c !== "transparent" && c !== "rgba(0, 0, 0, 0)";
  }
  function boxShadowEdgeHairline(boxShadow) {
    if (!boxShadow?.trim() || boxShadow.trim() === "none") return null;
    for (const layer of boxShadow.split(/,(?![^(]*\))/).map((s) => s.trim())) {
      if (/^inset\b/i.test(layer)) continue;
      const nums = layer.match(/-?[\d.]+px/g);
      if (!nums || nums.length < 2) continue;
      const offsetY = parseFloat(nums[1]);
      if (!Number.isFinite(offsetY) || Math.abs(offsetY) < MIN_EDGE_PX) continue;
      const blur = nums[2] ? parseFloat(nums[2]) : 0;
      const spread = nums[3] ? parseFloat(nums[3]) : 0;
      if (Math.abs(blur) >= MIN_EDGE_PX || Math.abs(spread) >= MIN_EDGE_PX) continue;
      const colorMatch = layer.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/i);
      if (!colorMatch) continue;
      return {
        edge: offsetY < 0 ? "top" : "bottom",
        color: colorMatch[0]
      };
    }
    return null;
  }
  function hasFullBoxBorder(styles) {
    const widths = [
      parseEdgeWidth(styles.borderTopWidth),
      parseEdgeWidth(styles.borderRightWidth),
      parseEdgeWidth(styles.borderBottomWidth),
      parseEdgeWidth(styles.borderLeftWidth)
    ];
    if (!widths.every((w) => w >= MIN_EDGE_PX)) return false;
    const colors = [
      styles.borderTopColor,
      styles.borderRightColor,
      styles.borderBottomColor,
      styles.borderLeftColor
    ];
    return colors.filter(isVisibleCssColor).length >= 4;
  }
  function structuralHairlinesFromStyles(styles, width, height, opts) {
    const lines = [];
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const skipBorderEdges = hasFullBoxBorder(styles) && opts?.includeFullBoxBorder !== true;
    if (!skipBorderEdges) {
      const topBorderW = parseEdgeWidth(styles.borderTopWidth);
      if (topBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderTopColor)) {
        lines.push({
          edge: "top",
          x: 0,
          y: 0,
          width: w,
          height: Math.max(1, Math.round(topBorderW)),
          color: styles.borderTopColor.trim()
        });
      }
      const bottomBorderW = parseEdgeWidth(styles.borderBottomWidth);
      if (bottomBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderBottomColor)) {
        lines.push({
          edge: "bottom",
          x: 0,
          y: Math.max(0, h - Math.max(1, Math.round(bottomBorderW))),
          width: w,
          height: Math.max(1, Math.round(bottomBorderW)),
          color: styles.borderBottomColor.trim()
        });
      }
      const leftBorderW = parseEdgeWidth(styles.borderLeftWidth);
      if (leftBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderLeftColor)) {
        lines.push({
          edge: "left",
          x: 0,
          y: 0,
          width: Math.max(1, Math.round(leftBorderW)),
          height: h,
          color: styles.borderLeftColor.trim()
        });
      }
      const rightBorderW = parseEdgeWidth(styles.borderRightWidth);
      if (rightBorderW >= MIN_EDGE_PX && isVisibleCssColor(styles.borderRightColor)) {
        lines.push({
          edge: "right",
          x: Math.max(0, w - Math.max(1, Math.round(rightBorderW))),
          y: 0,
          width: Math.max(1, Math.round(rightBorderW)),
          height: h,
          color: styles.borderRightColor.trim()
        });
      }
    }
    if (!lines.some((l) => l.edge === "top")) {
      const shadowTop = boxShadowEdgeHairline(styles.boxShadow);
      if (shadowTop?.edge === "top") {
        lines.push({ edge: "top", x: 0, y: 0, width: w, height: 1, color: shadowTop.color });
      }
    }
    if (!lines.some((l) => l.edge === "bottom")) {
      const shadowBottom = boxShadowEdgeHairline(styles.boxShadow);
      if (shadowBottom?.edge === "bottom") {
        lines.push({
          edge: "bottom",
          x: 0,
          y: Math.max(0, h - 1),
          width: w,
          height: 1,
          color: shadowBottom.color
        });
      }
    }
    return lines;
  }

  // src/lib/webImport/pmlButtonClass.ts
  function splitDomClassTokens(className) {
    return (className ?? "").trim().split(/\s+/).filter(Boolean);
  }
  function hasPmlStrokeButtonClassToken(className) {
    return splitDomClassTokens(className).some(
      (t) => /^btn--(?:stroke|outline|secondary|ghost)$/.test(t)
    );
  }

  // src/lib/webImport/domExtractor.ts
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
    const GLYPH_CAPTURE_LIMIT = 512;
    function captureBrowserTextLayout(el) {
      const textNodes = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let tn;
      while (tn = walker.nextNode()) {
        const t = tn;
        if ((t.textContent ?? "").length > 0) textNodes.push(t);
      }
      if (!textNodes.length) return void 0;
      const fullText = textNodes.map((t) => t.textContent ?? "").join("");
      if (!fullText.trim()) return void 0;
      const elRect = el.getBoundingClientRect();
      if (elRect.width < 0.5 || elRect.height < 0.5) return void 0;
      function posAt(index) {
        let rem = index;
        for (const t of textNodes) {
          const len = t.textContent?.length ?? 0;
          if (rem <= len) return { node: t, offset: rem };
          rem -= len;
        }
        const last = textNodes[textNodes.length - 1];
        return { node: last, offset: last.textContent?.length ?? 0 };
      }
      const range = document.createRange();
      const lines = [];
      const glyphs = [];
      let lineStart = 0;
      while (lineStart < fullText.length) {
        while (lineStart < fullText.length && fullText[lineStart] === " ") lineStart++;
        if (lineStart >= fullText.length) break;
        const startPos = posAt(lineStart);
        range.setStart(startPos.node, startPos.offset);
        const probeEnd = posAt(Math.min(lineStart + 1, fullText.length));
        range.setEnd(probeEnd.node, probeEnd.offset);
        const lineTop = range.getBoundingClientRect().top;
        let lo = lineStart + 1;
        let hi = fullText.length;
        let lineEnd = lo;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const endPos = posAt(mid);
          range.setStart(startPos.node, startPos.offset);
          range.setEnd(endPos.node, endPos.offset);
          const rects = Array.from(range.getClientRects());
          const sameLine = rects.length > 0 && rects.every((r) => Math.abs(r.top - lineTop) <= 1.5);
          if (sameLine) {
            lineEnd = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (lineEnd <= lineStart) lineEnd = Math.min(lineStart + 1, fullText.length);
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(posAt(lineEnd).node, posAt(lineEnd).offset);
        const lineRect = range.getBoundingClientRect();
        const lineText = fullText.slice(lineStart, lineEnd).replace(/\s+$/, "");
        lines.push({
          text: lineText,
          startIndex: lineStart,
          x: lineRect.left - elRect.left,
          y: lineRect.top - elRect.top,
          width: Math.max(1, lineRect.width),
          height: Math.max(1, lineRect.height),
          baselineY: lineRect.bottom - elRect.top
        });
        if (glyphs.length < GLYPH_CAPTURE_LIMIT) {
          for (let i = lineStart; i < lineEnd && glyphs.length < GLYPH_CAPTURE_LIMIT; i++) {
            const ch = fullText[i];
            if (ch === " " || ch === "\n" || ch === "	") continue;
            const s = posAt(i);
            const e = posAt(i + 1);
            range.setStart(s.node, s.offset);
            range.setEnd(e.node, e.offset);
            const gr = range.getBoundingClientRect();
            if (gr.width < 0.01 || gr.height < 0.01) continue;
            glyphs.push({
              index: i,
              x: gr.left - elRect.left,
              y: gr.top - elRect.top,
              width: gr.width,
              height: gr.height
            });
          }
        }
        lineStart = lineEnd;
        if (fullText[lineStart] === "\n") lineStart++;
      }
      if (!lines.length) return void 0;
      return {
        content: fullText.replace(/\s+/g, " ").trim(),
        lines,
        glyphs: glyphs.length ? glyphs : void 0
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
        if (kind === "before" && el.childElementCount > 0) {
          const bg = cs.backgroundColor;
          const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
          const decorative = !text?.trim();
          if (hasBg && decorative) continue;
        }
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
    function aggregateBadgeText(el) {
      const cls = (el.className ?? "").toString().toLowerCase();
      if (!/\bbadge\b|\bchip\b|\btag\b/.test(cls)) return void 0;
      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 200) : void 0;
    }
    function aggregateCalloutText(el) {
      const cls = (el.className ?? "").toString().toLowerCase();
      if (!/\b(?:callout|alert|notice|info|message|banner|hint|positive|negative|warning)\b/.test(cls) && !/\bob-flow__(?:message|hint|alert|info|callout)\b/.test(cls)) {
        return void 0;
      }
      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 4e3) : void 0;
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
    function soleElementText(el) {
      if (el.children.length > 0) return void 0;
      const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!t) return void 0;
      return t.slice(0, 4e3);
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
      const bridgeCapture = document.documentElement.getAttribute("data-craft-bridge-capture") === "1";
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
          const w2 = Math.max(1, textRect.width);
          const h = Math.max(1, textRect.height);
          children.push({
            id: nextId(),
            tagName: "span",
            text: trimmed,
            rect: {
              x: textRect.x + window.scrollX,
              y: textRect.y + window.scrollY,
              width: w2,
              height: h
            },
            styles: stylesOf(el),
            browserTextLayout: bridgeCapture ? {
              content: trimmed,
              lines: [
                {
                  text: trimmed,
                  startIndex: 0,
                  x: 0,
                  y: 0,
                  width: w2,
                  height: h,
                  baselineY: h
                }
              ]
            } : void 0,
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
      const styles = stylesOf(el);
      const bridgeCapture = document.documentElement.getAttribute("data-craft-bridge-capture") === "1";
      const rawClass = el.className;
      const className = typeof rawClass === "string" && rawClass.trim() ? rawClass.trim().replace(/\s+/g, " ").slice(0, 512) : void 0;
      const children = walkChildNodes(el, depth);
      const outlinedControlCapture = hasPmlStrokeButtonClassToken(className);
      if (bridgeCapture && rect.width >= 1 && rect.height >= 1) {
        for (const line of structuralHairlinesFromStyles(styles, rect.width, rect.height, {
          includeFullBoxBorder: outlinedControlCapture
        })) {
          children.push({
            id: nextId(),
            tagName: "div",
            className: `craft-capture-edge-${line.edge}`,
            rect: {
              x: rect.x + line.x,
              y: rect.y + line.y,
              width: line.width,
              height: line.height
            },
            styles: {
              backgroundColor: line.color,
              width: `${line.width}px`,
              height: `${line.height}px`
            },
            children: []
          });
        }
      }
      const controlText = aggregateControlText(el);
      const nestedText = aggregateNestedText(el);
      let text = leafText(el) ?? aggregateBadgeText(el) ?? aggregateCalloutText(el) ?? controlText ?? nestedText ?? soleElementText(el);
      if (bridgeCapture && tag === "input") {
        const inputVal = el.value?.replace(/\s+/g, " ").trim();
        if (inputVal) text = inputVal;
      }
      const browserTextLayout = bridgeCapture && text ? captureBrowserTextLayout(el) : void 0;
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
        browserTextLayout,
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
