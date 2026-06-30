"use client";

import { Suspense } from "react";
import { CanvasFloatingPageName } from "@/components/editor/CanvasFloatingPageName";
import { EditorRightActionsCard } from "@/components/editor/EditorRightActionsCard";

export function DashboardTopChrome({
  leftSidebarVisible = true,
}: {
  leftSidebarVisible?: boolean;
}) {
  return (
    <>
      <CanvasFloatingPageName leftSidebarVisible={leftSidebarVisible} />
      <div
        data-dashboard-right-actions
        className="pointer-events-auto fixed right-2 top-2 z-40"
      >
        <Suspense fallback={null}>
          <EditorRightActionsCard />
        </Suspense>
      </div>
    </>
  );
}
