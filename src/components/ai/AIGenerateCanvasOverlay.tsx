"use client";

import { useMemo, type CSSProperties } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useCanvasOverlaySpace } from "@/components/editor/useCanvasOverlaySpace";
import { worldLengthToOverlay, worldRectToOverlay } from "@/lib/canvasOverlaySpace";
import { AI_GENERATE_SKELETON_FRAME_ID } from "@/lib/aiGenerateJob";
import { useEditorStore } from "@/stores/useEditorStore";

const GRID_SPACING_PX = 22;
const FRAME_INSET_PX = 14;
const PLUS_SIZE_PX = 10;
const BLINK_COUNT = 34;

type GridCell = {
  x: number;
  y: number;
  index: number;
};

type BlinkPlus = GridCell & {
  duration: number;
  delay: number;
};

/** Deterministic pseudo-random in [0, 1). */
function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildPlusGrid(width: number, height: number): GridCell[] {
  if (width < 48 || height < 48) return [];

  const innerW = Math.max(1, width - FRAME_INSET_PX * 2);
  const innerH = Math.max(1, height - FRAME_INSET_PX * 2);
  const cols = Math.max(2, Math.round(innerW / GRID_SPACING_PX) + 1);
  const rows = Math.max(2, Math.round(innerH / GRID_SPACING_PX) + 1);
  const stepX = cols > 1 ? innerW / (cols - 1) : 0;
  const stepY = rows > 1 ? innerH / (rows - 1) : 0;

  const cells: GridCell[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        x: FRAME_INSET_PX + col * stepX,
        y: FRAME_INSET_PX + row * stepY,
        index: index++,
      });
    }
  }
  return cells;
}

function buildBlinkPluses(cells: GridCell[]): BlinkPlus[] {
  const count = Math.min(BLINK_COUNT, cells.length);
  return [...cells]
    .sort((a, b) => seededUnit(a.index * 31.7 + 5) - seededUnit(b.index * 31.7 + 5))
    .slice(0, count)
    .map((cell) => {
      const seed = cell.index + 1;
      return {
        ...cell,
        duration: 1.2 + seededUnit(seed * 5.7) * 1.8,
        delay: seededUnit(seed * 13.1) * 2.8,
      };
    });
}

const plusMarkStyle = (x: number, y: number, size: number): CSSProperties => ({
  left: x,
  top: y,
  width: size,
  height: size,
  transform: "translate(-50%, -50%)",
});

function StaticPlusMark({ cell, isLight }: { cell: GridCell; isLight: boolean }) {
  return (
    <Plus
      className={
        isLight
          ? "pointer-events-none absolute text-neutral-500/55"
          : "pointer-events-none absolute text-neutral-500/40"
      }
      strokeWidth={1.5}
      aria-hidden
      style={plusMarkStyle(cell.x, cell.y, PLUS_SIZE_PX)}
    />
  );
}

function BlinkPlusMark({ mark, isLight }: { mark: BlinkPlus; isLight: boolean }) {
  return (
    <div
      className="pointer-events-none absolute z-[1]"
      aria-hidden
      style={{
        ...plusMarkStyle(mark.x, mark.y, PLUS_SIZE_PX),
        animation: `aiGenPlusBlink ${mark.duration}s ease-in-out ${mark.delay}s infinite`,
      }}
    >
      {isLight ? (
        <Plus
          className="h-full w-full"
          strokeWidth={2}
          style={{ color: "#000000" }}
        />
      ) : (
        <Plus
          className="h-full w-full"
          strokeWidth={2}
          style={{ color: "#ffffff", filter: "drop-shadow(0 0 3px rgba(255, 255, 255, 0.45))" }}
        />
      )}
    </div>
  );
}

function SkeletonPlusField({
  width,
  height,
  cornerRadius,
  isLight,
}: {
  width: number;
  height: number;
  cornerRadius: number;
  isLight: boolean;
}) {
  const { grid, blinkers } = useMemo(() => {
    const grid = buildPlusGrid(width, height);
    return { grid, blinkers: buildBlinkPluses(grid) };
  }, [width, height]);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ borderRadius: cornerRadius }}
    >
      {grid.map((cell) => (
        <StaticPlusMark key={`static-${cell.index}`} cell={cell} isLight={isLight} />
      ))}
      {blinkers.map((mark) => (
        <BlinkPlusMark key={`blink-${mark.index}`} mark={mark} isLight={isLight} />
      ))}
    </div>
  );
}

/** Plus grid skeleton overlay while AI generates. */
export function AIGenerateCanvasOverlay() {
  const active = useEditorStore((s) => s.aiGenerateActive);
  const step = useEditorStore((s) => s.aiGenerateStep);
  const nodes = useEditorStore((s) => s.nodes);
  const cancel = useEditorStore((s) => s.cancelAIGenerate);
  const space = useCanvasOverlaySpace();
  const { resolved: theme } = useTheme();
  const isLight = theme === "light";

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

  const cornerRadiusPx = skeleton
    ? worldLengthToOverlay(skeleton.cornerRadius ?? 24, space)
    : 24;

  if (!active) return null;

  return (
    <>
      {frameOverlay ? (
        <div
          className={
            isLight
              ? "pointer-events-none absolute z-[44] overflow-hidden ring-1 ring-neutral-300/50"
              : "pointer-events-none absolute z-[44] overflow-hidden ring-1 ring-neutral-600/35"
          }
          style={{
            left: frameOverlay.x,
            top: frameOverlay.y,
            width: frameOverlay.width,
            height: frameOverlay.height,
            borderRadius: cornerRadiusPx,
          }}
          aria-hidden
        >
          <SkeletonPlusField
            width={frameOverlay.width}
            height={frameOverlay.height}
            cornerRadius={cornerRadiusPx}
            isLight={isLight}
          />
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
