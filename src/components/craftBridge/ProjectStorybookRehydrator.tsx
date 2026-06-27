"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/useEditorStore";

/** Import Components/* stories from Storybook when a bridge link is active. */
export function ProjectStorybookRehydrator() {
  const codeRoundTripLink = useEditorStore((s) => s.codeRoundTripLink);
  const storybookUrl = useEditorStore((s) => s.storybookUrl);
  const rehydrate = useEditorStore((s) => s.rehydrateProjectStorybookComponentsIfNeeded);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!codeRoundTripLink?.repoRoot && !storybookUrl) return;
    startedRef.current = true;
    void rehydrate();
  }, [codeRoundTripLink, storybookUrl, rehydrate]);

  return null;
}
