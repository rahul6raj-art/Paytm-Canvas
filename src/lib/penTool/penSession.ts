import { resolvePenDragPreview } from "./placement";
import { resolvePenCommitCornerPoint, resolvePenPointCommit } from "./penInteraction";
import { isPenShiftKeyEvent } from "./penShiftPreview";
import { type PenPlacement, type PenPointerState } from "./types";

export type PenSessionCallbacks = {
  onPlacementChange: (placement: PenPlacement | null) => void;
  onStateChange?: (state: PenPointerState) => void;
  onSessionEnd?: () => void;
  commitCornerPoint: (world: { x: number; y: number }) => void;
  commitSmoothPoint: (
    anchorWorld: { x: number; y: number },
    dragWorld: { x: number; y: number },
  ) => void;
};

export type PenSessionOptions = {
  getPreviousAnchor: () => { x: number; y: number } | null;
  toWorld: (clientX: number, clientY: number) => { x: number; y: number };
  /** Screen-calibrated drag threshold in world units (from zoom). */
  curveDragThresholdWorld: number;
};

/** Manages pen drawing pointer capture, preview, and commit. */
export class PenDrawSession {
  private state: PenPointerState = "idle";
  private anchor: { x: number; y: number };
  private placement: PenPlacement | null = null;
  private shiftKey = false;
  private pressRaw: { x: number; y: number };
  private lastRaw: { x: number; y: number } | null = null;
  private pointerId: number;
  private captureTarget: HTMLElement;
  private cleanupListeners: (() => void) | null = null;
  private ended = false;

  constructor(
    anchorWorld: { x: number; y: number },
    pressRawWorld: { x: number; y: number },
    pointerId: number,
    captureTarget: HTMLElement,
    initialShiftKey: boolean,
    private readonly opts: PenSessionOptions,
    private readonly cb: PenSessionCallbacks,
  ) {
    this.anchor = { ...anchorWorld };
    this.pressRaw = { ...pressRawWorld };
    this.pointerId = pointerId;
    this.captureTarget = captureTarget;
    this.shiftKey = initialShiftKey;
    this.lastRaw = { ...pressRawWorld };
    this.state = "draggingNewHandle";
    this.cb.onStateChange?.(this.state);
    this.syncPlacementFromLastRaw();
  }

  getPointerState(): PenPointerState {
    return this.state;
  }

  getPlacement(): PenPlacement | null {
    return this.placement;
  }

  attach(): () => void {
    try {
      this.captureTarget.setPointerCapture(this.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== this.pointerId || this.ended) return;
      this.applyPointer(ev.clientX, ev.clientY, ev.shiftKey);
    };

    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== this.pointerId || this.ended) return;
      this.applyPointer(ev.clientX, ev.clientY, ev.shiftKey);
      this.finish(ev.type === "pointerup");
    };

    const onShiftKey = (ev: KeyboardEvent) => {
      if (this.ended || !isPenShiftKeyEvent(ev)) return;
      this.shiftKey = ev.shiftKey;
      this.syncPlacementFromLastRaw();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("keydown", onShiftKey);
    window.addEventListener("keyup", onShiftKey);

    this.cleanupListeners = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("keydown", onShiftKey);
      window.removeEventListener("keyup", onShiftKey);
    };

    return () => this.cancel();
  }

  private applyPointer(clientX: number, clientY: number, shiftKey: boolean): void {
    this.shiftKey = shiftKey;
    const raw = this.opts.toWorld(clientX, clientY);
    this.lastRaw = raw;
    this.syncPlacementFromLastRaw();
  }

  private syncPlacementFromLastRaw(): void {
    if (!this.lastRaw) return;
    const drag = this.constrainDrag(this.lastRaw);
    this.placement = {
      anchor: { ...this.anchor },
      drag,
      rawDrag: { ...this.lastRaw },
      pressRaw: { ...this.pressRaw },
      shiftKey: this.shiftKey,
    };
    this.cb.onPlacementChange(this.placement);
  }

  private constrainDrag(raw: { x: number; y: number }): { x: number; y: number } {
    return resolvePenDragPreview(this.anchor, raw, this.shiftKey);
  }

  private finish(commit: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.cleanupListeners?.();
    this.cleanupListeners = null;
    try {
      this.captureTarget.releasePointerCapture(this.pointerId);
    } catch {
      /* ignore */
    }
    const placement = this.placement;
    this.placement = null;
    this.cb.onPlacementChange(null);
    this.state = commit ? "drawing" : "idle";
    this.cb.onStateChange?.(this.state);
    this.cb.onSessionEnd?.();

    if (!commit || !placement) return;
    if (resolvePenPointCommit(placement, this.opts.curveDragThresholdWorld) === "smooth") {
      this.cb.commitSmoothPoint(placement.anchor, placement.drag);
    } else {
      const prev = this.opts.getPreviousAnchor();
      const commitPoint = resolvePenCommitCornerPoint(
        placement,
        prev,
        this.shiftKey,
        this.lastRaw ?? placement.drag,
      );
      this.cb.commitCornerPoint(commitPoint);
    }
  }

  cancel(): void {
    this.finish(false);
  }
}
