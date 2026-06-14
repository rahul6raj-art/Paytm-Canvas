"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";

const SCRUB_MOVE_THRESHOLD_PX = 2;

export function clampInspectorScrubValue(
  n: number,
  min: number | undefined,
  max: number | undefined,
  decimals: number,
): number {
  let v = n;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v);
}

export function valueFromScrubDrag(
  startValue: number,
  startX: number,
  currentX: number,
  options: {
    step?: number;
    decimals?: number;
    shift?: boolean;
    alt?: boolean;
    min?: number;
    max?: number;
  },
): number {
  const decimals = options.decimals ?? 0;
  const step = options.step ?? (decimals > 0 ? 10 ** -decimals : 1);
  const stepSize = keyboardNudgeStep(step, decimals, options.shift ?? false, options.alt ?? false);
  const pixels = Math.round(currentX - startX);
  return clampInspectorScrubValue(
    startValue + pixels * stepSize,
    options.min,
    options.max,
    decimals,
  );
}

type ScrubSession = {
  pointerId: number;
  startX: number;
  startValue: number;
  lastValue: number;
  moved: boolean;
  target: HTMLInputElement;
  onWindowMove: (ev: PointerEvent) => void;
  onWindowEnd: (ev: PointerEvent) => void;
};

export type UseInspectorValueScrubOptions = {
  disabled?: boolean;
  value: number;
  decimals?: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

export function useInspectorValueScrub({
  disabled,
  value,
  decimals = 0,
  step,
  min,
  max,
  onChange,
}: UseInspectorValueScrubOptions) {
  const sessionRef = useRef<ScrubSession | null>(null);
  const onChangeRef = useRef(onChange);
  const scrubActiveRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const clearBodyScrubStyles = useCallback(() => {
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const detachWindowListeners = useCallback((session: ScrubSession) => {
    window.removeEventListener("pointermove", session.onWindowMove);
    window.removeEventListener("pointerup", session.onWindowEnd);
    window.removeEventListener("pointercancel", session.onWindowEnd);
  }, []);

  const endSession = useCallback(
    (session: ScrubSession, focusIfTap: boolean) => {
      detachWindowListeners(session);
      if (session.target.hasPointerCapture(session.pointerId)) {
        try {
          session.target.releasePointerCapture(session.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (focusIfTap && !session.moved) {
        session.target.focus();
        session.target.select();
      }
      sessionRef.current = null;
      scrubActiveRef.current = false;
      setScrubbing(false);
      clearBodyScrubStyles();
    },
    [clearBodyScrubStyles, detachWindowListeners],
  );

  const applyScrubMove = useCallback(
    (session: ScrubSession, clientX: number, shiftKey: boolean, altKey: boolean) => {
      const dx = clientX - session.startX;
      if (!session.moved && Math.abs(dx) < SCRUB_MOVE_THRESHOLD_PX) return;
      if (!session.moved) {
        session.moved = true;
        scrubActiveRef.current = true;
        setScrubbing(true);
        session.target.blur();
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
      }
      const next = valueFromScrubDrag(session.startValue, session.startX, clientX, {
        step,
        decimals,
        shift: shiftKey,
        alt: altKey,
        min,
        max,
      });
      if (next === session.lastValue) return;
      session.lastValue = next;
      onChangeRef.current(next);
    },
    [decimals, max, min, step],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLInputElement>) => {
      if (disabled) return;
      e.preventDefault();
      const target = e.currentTarget;
      const session: ScrubSession = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startValue: value,
        lastValue: value,
        moved: false,
        target,
        onWindowMove: (ev: PointerEvent) => {
          const active = sessionRef.current;
          if (!active || ev.pointerId !== active.pointerId) return;
          ev.preventDefault();
          applyScrubMove(active, ev.clientX, ev.shiftKey, ev.altKey);
        },
        onWindowEnd: (ev: PointerEvent) => {
          const active = sessionRef.current;
          if (!active || ev.pointerId !== active.pointerId) return;
          endSession(active, true);
        },
      };
      sessionRef.current = session;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.addEventListener("pointermove", session.onWindowMove);
      window.addEventListener("pointerup", session.onWindowEnd);
      window.addEventListener("pointercancel", session.onWindowEnd);
    },
    [applyScrubMove, disabled, endSession, value],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLInputElement>) => {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      e.preventDefault();
      applyScrubMove(session, e.clientX, e.shiftKey, e.altKey);
    },
    [applyScrubMove],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLInputElement>) => {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      endSession(session, true);
    },
    [endSession],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLInputElement>) => {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      endSession(session, false);
    },
    [endSession],
  );

  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (session) endSession(session, false);
    };
  }, [endSession]);

  const scrubInputClassName = disabled
    ? "cursor-not-allowed"
    : scrubbing
      ? "cursor-ew-resize select-none touch-none"
      : "cursor-ew-resize touch-none";

  const bindScrubInput = useCallback(
    (className?: string, focused?: boolean) => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      readOnly: scrubActiveRef.current || scrubbing || undefined,
      className: cn(className, focused && !scrubbing ? "cursor-text" : scrubInputClassName),
    }),
    [
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      scrubInputClassName,
      scrubbing,
    ],
  );

  return {
    scrubbing,
    scrubActiveRef,
    scrubInputClassName,
    bindScrubInput,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
