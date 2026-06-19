import type { DomSnapshotNode, SemanticRole } from "@/lib/webImport/types";
import { isTailwindUtilityText } from "@/lib/webImport/textContentHeuristics";

const BUTTON_TAGS = new Set(["button"]);
const INPUT_TAGS = new Set(["input", "textarea", "select"]);
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "li"]);
const NAV_TAGS = new Set(["nav"]);
const HEADER_TAGS = new Set(["header"]);
const FOOTER_TAGS = new Set(["footer"]);

export function detectSemanticRole(node: DomSnapshotNode, depth = 0): SemanticRole | undefined {
  const tag = node.tagName.toLowerCase();
  const role = (node.role ?? "").toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  const aria = (node.ariaLabel ?? "").toLowerCase();

  if (role === "button" || BUTTON_TAGS.has(tag)) return "button";
  if (role === "navigation" || NAV_TAGS.has(tag) || cls.includes("navbar") || cls.includes("nav-bar")) {
    return "navbar";
  }
  if (cls.includes("sidebar") || (tag === "aside" && node.rect.width < 400)) return "sidebar";
  if (role === "dialog" || cls.includes("modal") || cls.includes("dialog")) return "modal";
  if (INPUT_TAGS.has(tag) || role === "textbox" || role === "combobox") {
    return tag === "select" || role === "combobox" ? "dropdown" : "input";
  }
  if (tag === "img" && node.rect.width <= 64 && node.rect.height <= 64) return "avatar";
  if (tag === "img") return "image";
  if (tag === "li" || role === "listitem") return "list-item";
  if (tag === "a" && node.text) return node.styles.display?.includes("inline") ? "link" : "button";
  if (tag === "a") return "link";
  if (cls.includes("badge") || cls.includes("chip") || cls.includes("tag")) return "badge";
  if (TEXT_TAGS.has(tag) && node.text) return "text";
  if (HEADER_TAGS.has(tag) || (depth <= 2 && node.rect.y < 120 && node.rect.height < 120)) return "header";
  if (FOOTER_TAGS.has(tag)) return "footer";
  if (NAV_TAGS.has(tag)) return "nav";
  if (tag === "main" && node.rect.height > 300) return "hero";
  if (isInputLikeDiv(node)) return "input";
  if (isCardLike(node) && !hasFormControls(node)) return "card";
  if (["section", "main", "article"].includes(tag)) return "section";
  if (node.sectionHint) return node.sectionHint as SemanticRole;
  if (node.componentHint === "button") return "button";
  if (node.componentHint === "card") return "card";
  if (node.componentHint === "input") return "input";
  if (node.componentHint === "image") return "image";
  if (node.componentHint === "text") return "text";
  if (node.componentHint === "link") return "link";
  return undefined;
}

function isCardLike(node: DomSnapshotNode): boolean {
  if (node.children.length < 2) return false;
  const hasBg = Boolean(node.styles.backgroundColor && node.styles.backgroundColor !== "rgba(0, 0, 0, 0)");
  const hasRadius = Boolean(node.styles.borderRadius && node.styles.borderRadius !== "0px");
  const hasShadow = Boolean(node.styles.boxShadow && node.styles.boxShadow !== "none");
  return node.rect.width > 120 && node.rect.height > 80 && (hasBg || hasRadius || hasShadow);
}

function hasFormControls(node: DomSnapshotNode): boolean {
  const walk = (n: DomSnapshotNode): boolean => {
    const tag = n.tagName.toLowerCase();
    if (INPUT_TAGS.has(tag) || BUTTON_TAGS.has(tag)) return true;
    if (n.role === "textbox" || n.role === "button") return true;
    return n.children.some(walk);
  };
  return walk(node);
}

function isInputLikeDiv(node: DomSnapshotNode): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== "div") return false;
  const cls = (node.className ?? "").toLowerCase();
  const h = node.rect.height;
  if (h < 28 || h > 96) return false;
  const hasBorder =
    parseFloatSafe(node.styles.borderTopWidth) > 0 ||
    Boolean(node.styles.boxShadow && /0px?\s+0px?\s+0px?\s+[\d.]+px/.test(node.styles.boxShadow)) ||
    /\bring\b|\bborder\b|\brounded/.test(cls);
  const hasFieldClass = /\binput\b|textbox|form-control|field|bg-background/.test(cls);
  const hasPlaceholder = Boolean(node.placeholder || node.ariaLabel);
  const hasInputChild = node.children.some((c) => c.tagName.toLowerCase() === "input");
  const role = (node.role ?? "").toLowerCase();
  const isTextbox = role === "textbox" || role === "combobox";
  const hasSingleTextChild =
    node.children.length === 1 && node.children[0]?.tagName.toLowerCase() === "span";
  return (
    isTextbox ||
    hasInputChild ||
    hasFieldClass ||
    hasPlaceholder ||
    (hasBorder && (hasSingleTextChild || node.children.length === 0))
  );
}

function parseFloatSafe(v: string | undefined): number {
  const n = parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export function semanticDisplayName(role: SemanticRole | undefined, node: DomSnapshotNode): string {
  if (node.ariaLabel?.trim()) return node.ariaLabel.trim().slice(0, 48);
  if (role) {
    const label = role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, " ");
    if (role === "button" || role === "input" || role === "card") {
      if (node.text?.trim()) return node.text.trim().slice(0, 40);
      if (node.placeholder?.trim()) return node.placeholder.trim().slice(0, 40);
      return label;
    }
  }
  const cls = node.className
    ?.split(/\s+/)
    .find((c) => c && !c.startsWith("_") && !isTailwindUtilityText(c));
  if (cls && !isTailwindUtilityText(cls)) return cls.slice(0, 48);
  const tag = node.tagName.toLowerCase();
  if (node.text && TEXT_TAGS.has(tag)) return node.text.slice(0, 40);
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
