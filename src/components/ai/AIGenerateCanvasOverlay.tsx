"use client";

import { useMemo, type CSSProperties } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useCanvasOverlaySpace } from "@/components/editor/useCanvasOverlaySpace";
import { worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import { AI_GENERATE_SKELETON_FRAME_ID } from "@/lib/aiGenerateJob";
import { useEditorStore } from "@/stores/useEditorStore";

const PLUS_COUNT = 18;

type BlinkPlus = {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  peakOpacity: number;
};

/** Deterministic pseudo-random in [0, 1). */
function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildBlinkPluses(): BlinkPlus[] {
  return Array.from({ length: PLUS_COUNT }, (_, i) => {
    const seed = i + 1;
    const edgePad = 0.1;
    return {
      x: edgePad + seededUnit(seed * 3.17) * (1 - edgePad * 2),
      y: edgePad + seededUnit(seed * 7.91) * (1 - edgePad * 2),
      size: 8 + Math.round(seededUnit(seed * 11.3) * 6),
      duration: 1.4 + seededUnit(seed * 5.7) * 2.2,
      delay: seededUnit(seed * 13.1) * 3.5,
      peakOpacity: 0.35 + seededUnit(seed * 17.9) * 0.45,
    };
  });
}

function BlinkPlusMark({ mark }: { mark: BlinkPlus }) {
  return (
    <Plus
      className="pointer-events-none absolute ai-gen-plus-blink text-neutral-400"
      strokeWidth={1.5}
      aria-hidden
      style={
        {
          left: `${mark.x * 100}%`,
          top: `${mark.y * 100}%`,
          width: mark.size,
          height: mark.size,
          ["--plus-peak-opacity" as string]: mark.peakOpacity,
          animationDuration: `${mark.duration}s`,
          animationDelay: `${mark.delay}s`,
          transform: "translate(-50%, -50%)",
        } as CSSProperties
      }
    />
  );
}

function SkeletonPlusField({ cornerRadius }: { cornerRadius: number }) {
  const pluses = useMemo(() => buildBlinkPluses(), []);
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ borderRadius: cornerRadius }}
    >
      {pluses.map((mark, idx) => (
        <BlinkPlusMark key={idx} mark={mark} />
      ))}
    </div>
  );
}

/** Blinking plus icons scattered over the skeleton frame while AI generates. */
export function AIGenerateCanvasOverlay() {
  const active = useEditorStore((s) => s.aiGenerateActive);
  const step = useEditorStore((s) => s.aiGenerateStep);
  const nodes = useEditorStore((s) => s.nodes);
  const cancel = useEditorStore((s) => s.cancelAIGenerate);
  const space = useCanvasOverlaySpace();

  const skeleton = nodes[AI_GENERATE_SKELETON_FRAME_ID];

  const frameOverlay = useMemo(() => {
    if (!skeleton) return null;
    return worldRectToOverlay(
      {
        x: skeleton.x,
        y: skeleton.y,
        width: skeleton.width,
        height: skeleton.height,
      },
      space,
    );
  }, [skeleton, space]);

  const cornerRadius = skeleton?.cornerRadius ?? 24;

  if (!active) return null;

  return (
    <>
      {frameOverlay ? (
        <div
          className="pointer-events-none absolute z-[44] overflow-hidden ring-1 ring-neutral-300/45"
          style={{
            left: frameOverlay.x,
            top: frameOverlay.y,
            width: frameOverlay.width,
            height: frameOverlay.height,
            borderRadius: cornerRadius,
          }}
          aria-hidden
        >
          <SkeletonPlusField cornerRadius={cornerRadius} />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-14 z-[45] flex justify-center px-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Generating design"
      >
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-white/15 bg-black/70 px-4 py-2.5 shadow-xl backdrop-blur-md">
          <Sparkles className="h-4 w-4 shrink-0 text-neutral-200" strokeWidth={2} />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-ui-sm font-semibold text-white">Building your screen</p>
            <p className="truncate text-ui text-white/70">{step ?? "Applying design tokens…"}</p>
          </div>
          <button
            type="button"
            className="shrink-0 text-ui font-medium text-white/50 hover:text-white"
            onClick={() => cancel()}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
