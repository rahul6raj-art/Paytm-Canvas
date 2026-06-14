# Track 26 — Figma canvas chrome

**Status:** complete (phases 26.1–26.2)

Editor tools lived in the horizontal top bar. This track adds **Figma-style canvas chrome**: vertical tool rail, rubber-band shape preview, and a floating selection toolbar.

## Goals

- **`CanvasToolRail`** — vertical tool rail on the canvas (move, frame, shapes, pen, text, hand, comment).
- **`ShapeDrawPreview`** — dashed rubber-band + dimension badge while dragging new shapes/frames/text.
- **`CanvasFloatingToolbar`** — align / boolean / stroke controls floated above the selection.
- Slim **TopToolbar** — document actions + mode tabs only (creation tools on the rail).

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **26.1** | `CanvasToolRail` + move tools off top bar | **Done** |
| **26.2** | `ShapeDrawPreview` + `CanvasFloatingToolbar` | **Done** |

## Manual

```bash
npm run dev
# Tool rail: left edge of canvas
# Draw a rectangle: dashed preview + W×H badge while dragging
# Select a layer: floating toolbar above selection
```

## Verification

```bash
npm run verify:canvas-chrome
npm test -- src/lib/__tests__/canvasChrome.test.ts
```

## Next

Integration tracks **2–36** are complete. See [live-stack-gate-track.md](./live-stack-gate-track.md) for offline live stack smoke wiring.
