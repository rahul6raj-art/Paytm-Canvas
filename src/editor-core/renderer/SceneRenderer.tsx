"use client";

import { isSvgDomHitFallbackEnabled, isSvgRendererEnabled } from "@/lib/rendererMode";
import { DomSceneRenderer } from "./DomSceneRenderer";
import { SvgDomOverlays } from "./SvgDomOverlays";
import { SvgHitLayer } from "./SvgHitLayer";
import { SvgHoverOutline } from "./SvgHoverOutline";
import { SvgSceneRenderer } from "./SvgSceneRenderer";
import type { SceneRendererProps } from "./RendererTypes";

/**
 * Scene graph entry: DOM (default) or experimental SVG scene + SVG hit layer.
 */
export function SceneRenderer(props: SceneRendererProps) {
  if (!isSvgRendererEnabled()) {
    return <DomSceneRenderer {...props} />;
  }

  if (isSvgDomHitFallbackEnabled()) {
    return (
      <>
        <SvgSceneRenderer {...props} />
        <div
          className="pointer-events-none absolute inset-0 z-[2] opacity-0"
          aria-hidden
          data-svg-dom-hit-fallback
        >
          <DomSceneRenderer {...props} />
        </div>
      </>
    );
  }

  return (
    <>
      <SvgSceneRenderer {...props} />
      <SvgHitLayer
        rootIds={props.rootIds}
        nodes={props.nodes}
        childOrder={props.childOrder}
        zoom={props.zoom}
      />
      <SvgHoverOutline />
      <SvgDomOverlays />
    </>
  );
}
