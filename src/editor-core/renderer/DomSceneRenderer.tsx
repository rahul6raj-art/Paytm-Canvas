"use client";

import { CanvasObject } from "@/components/editor/CanvasObject";
import type { SceneRendererProps } from "./RendererTypes";

/** Default DOM scene graph (CanvasObject / Artboard). */
export function DomSceneRenderer({ rootIds }: SceneRendererProps) {
  return (
    <>
      {rootIds.map((rid) => (
        <CanvasObject key={rid} id={rid} />
      ))}
    </>
  );
}
