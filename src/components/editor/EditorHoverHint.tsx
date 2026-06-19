"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { parseEditorHintTitle } from "@/lib/editorHoverHint";

export type EditorHoverHintSide = "top" | "bottom" | "left" | "right";

const HINT_GAP = 8;
const POINTER_HINT_OFFSET_X = 12;
const POINTER_HINT_OFFSET_Y = 14;

function resolveAnchorRect(anchor: HTMLElement): DOMRect {
  const rect = anchor.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return rect;
  const child = anchor.firstElementChild;
  if (child instanceof HTMLElement) {
    const childRect = child.getBoundingClientRect();
    if (childRect.width > 0 || childRect.height > 0) return childRect;
  }
  return rect;
}

function computePointerHintPosition(
  pointer: { x: number; y: number },
  tip: DOMRect,
): { left: number; top: number } {
  let left = pointer.x + POINTER_HINT_OFFSET_X;
  let top = pointer.y + POINTER_HINT_OFFSET_Y;
  const pad = 8;

  if (left + tip.width > window.innerWidth - pad) {
    left = pointer.x - tip.width - POINTER_HINT_OFFSET_X;
  }
  if (top + tip.height > window.innerHeight - pad) {
    top = pointer.y - tip.height - POINTER_HINT_OFFSET_Y;
  }

  left = Math.max(pad, Math.min(left, window.innerWidth - tip.width - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - tip.height - pad));

  return { left, top };
}

function computeHintPosition(
  anchor: DOMRect,
  tip: DOMRect,
  side: EditorHoverHintSide,
): { left: number; top: number } {
  let left = 0;
  let top = 0;

  switch (side) {
    case "top":
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      top = anchor.top - tip.height - HINT_GAP;
      break;
    case "bottom":
      left = anchor.left + anchor.width / 2 - tip.width / 2;
      top = anchor.bottom + HINT_GAP;
      break;
    case "left":
      left = anchor.left - tip.width - HINT_GAP;
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      break;
    case "right":
      left = anchor.right + HINT_GAP;
      top = anchor.top + anchor.height / 2 - tip.height / 2;
      break;
  }

  const pad = 8;
  left = Math.max(pad, Math.min(left, window.innerWidth - tip.width - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - tip.height - pad));

  return { left, top };
}

function HintBubble({
  label,
  shortcut,
}: {
  label: string;
  shortcut?: string;
}) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-black px-3 py-1.5 text-[13px] font-medium leading-snug text-white shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
      <span>{label}</span>
      {shortcut ? <span className="text-white/45">{shortcut}</span> : null}
    </span>
  );
}

export function EditorHoverHint({
  label,
  shortcut,
  side = "top",
  disabled,
  className,
  anchorClassName,
  followPointer,
  children,
}: {
  label: string;
  shortcut?: string;
  side?: EditorHoverHintSide;
  disabled?: boolean;
  /** @deprecated Use anchorClassName */
  className?: string;
  /** Wrapper around the child; use `contents` for absolutely positioned controls. */
  anchorClassName?: string;
  /** Position the hint near the cursor instead of the anchor box. */
  followPointer?: boolean;
  children: ReactElement;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const anchorUsesContents = Boolean(anchorClassName?.includes("contents"));
  const trackPointer = followPointer ?? anchorUsesContents;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !tipRef.current) {
      setPosition(null);
      return;
    }

    const update = () => {
      if (!anchorRef.current || !tipRef.current) return;
      const tipRect = tipRef.current.getBoundingClientRect();
      if (trackPointer && pointer) {
        setPosition(computePointerHintPosition(pointer, tipRect));
        return;
      }
      setPosition(
        computeHintPosition(resolveAnchorRect(anchorRef.current), tipRect, side),
      );
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, side, label, shortcut, trackPointer, pointer]);

  const showHintAt = (clientX: number, clientY: number) => {
    if (disabled) return;
    setVisible(true);
    if (trackPointer) setPointer({ x: clientX, y: clientY });
  };

  const hideHint = () => {
    setVisible(false);
    setPointer(null);
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    if (disabled || !trackPointer) return;
    setPointer({ x: e.clientX, y: e.clientY });
  };

  const onPointerOverCapture = (e: React.PointerEvent) => {
    const related = e.relatedTarget;
    if (related instanceof Node && e.currentTarget.contains(related)) return;
    showHintAt(e.clientX, e.clientY);
  };

  const onPointerOutCapture = (e: React.PointerEvent) => {
    const related = e.relatedTarget;
    if (related instanceof Node && e.currentTarget.contains(related)) return;
    hideHint();
  };

  const tooltip =
    mounted && visible && !disabled ? (
      <span
        ref={tipRef}
        role="tooltip"
        className={cn(
          "pointer-events-none fixed z-[500] transition-opacity duration-150",
          position ? "opacity-100" : "opacity-0",
        )}
        style={position ? { left: position.left, top: position.top } : { left: 0, top: 0 }}
      >
        <HintBubble label={label} shortcut={shortcut} />
      </span>
    ) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={cn("relative inline-flex", anchorClassName ?? className)}
        onPointerOverCapture={onPointerOverCapture}
        onPointerMoveCapture={onPointerMoveCapture}
        onPointerOutCapture={onPointerOutCapture}
        onFocusCapture={(e) => {
          const rect = resolveAnchorRect(e.currentTarget);
          showHintAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) hideHint();
        }}
      >
        {children}
      </span>
      {mounted && tooltip ? createPortal(tooltip, document.body) : null}
    </>
  );
}

/** Wrap any control and replace its native `title` with the Figma-style hover hint. */
export function EditorHintWrap({
  title,
  hintLabel,
  hintShortcut,
  hintSide = "top",
  disabled,
  className,
  anchorClassName,
  followPointer,
  children,
}: {
  title?: string;
  hintLabel?: string;
  hintShortcut?: string;
  hintSide?: EditorHoverHintSide;
  disabled?: boolean;
  /** @deprecated Use anchorClassName */
  className?: string;
  anchorClassName?: string;
  followPointer?: boolean;
  children: ReactNode;
}) {
  const parsed = title && !hintLabel ? parseEditorHintTitle(title) : null;
  const label = hintLabel ?? parsed?.label;
  const shortcut = hintShortcut ?? parsed?.shortcut;

  if (!label) return <>{children}</>;

  const child = Children.only(children);
  const hintedChild = isValidElement(child)
    ? cloneElement(child, { title: undefined } as Record<string, unknown>)
    : child;

  if (!isValidElement(hintedChild)) return <>{children}</>;

  return (
    <EditorHoverHint
      label={label}
      shortcut={shortcut}
      side={hintSide}
      disabled={disabled}
      className={className}
      anchorClassName={anchorClassName}
      followPointer={followPointer}
    >
      {hintedChild}
    </EditorHoverHint>
  );
}
