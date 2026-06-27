"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/useEditorStore";

/** Restore linked page CSS + dual-mode tokens after reload (bridge documents). */
export function ProjectColorRehydrator() {
  const codeRoundTripLink = useEditorStore((s) => s.codeRoundTripLink);
  const projectCssSources = useEditorStore((s) => s.projectCssSources);
  const rehydrate = useEditorStore((s) => s.rehydrateProjectColorTokensIfNeeded);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!codeRoundTripLink?.repoRoot && projectCssSources.length === 0) return;
    startedRef.current = true;
    void rehydrate();
  }, [codeRoundTripLink, projectCssSources.length, rehydrate]);

  return null;
}
