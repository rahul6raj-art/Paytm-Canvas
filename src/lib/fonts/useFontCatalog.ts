"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildFontCatalog,
  filterFontCatalog,
  setInstalledFontOptions,
  setUploadedFontOptions,
  type FontCatalogGroup,
  type FontFamilyOption,
} from "./fontCatalog";
import { localFontsSupported, queryInstalledFontOptions } from "./localFonts";
import { uploadedFontOptionsFromAssets } from "./uploadedFonts";
import { useEditorStore } from "@/stores/useEditorStore";

export function useFontCatalog() {
  const fontAssets = useEditorStore((s) => s.fontAssets);
  const [installed, setInstalled] = useState<FontFamilyOption[]>([]);
  const [localStatus, setLocalStatus] = useState<"idle" | "loading" | "ready" | "unsupported">(
    "idle",
  );

  const refreshInstalled = useCallback(async () => {
    if (!localFontsSupported()) {
      setLocalStatus("unsupported");
      return;
    }
    setLocalStatus("loading");
    const fonts = await queryInstalledFontOptions();
    setInstalled(fonts);
    setInstalledFontOptions(fonts);
    setLocalStatus("ready");
  }, []);

  useEffect(() => {
    void refreshInstalled();
  }, [refreshInstalled]);

  const uploaded = useMemo(() => uploadedFontOptionsFromAssets(fontAssets), [fontAssets]);

  useEffect(() => {
    setUploadedFontOptions(uploaded);
  }, [uploaded]);

  const groups = useMemo(() => buildFontCatalog(installed, uploaded), [installed, uploaded]);

  return {
    groups,
    installed,
    localStatus,
    localFontsSupported: localFontsSupported(),
    refreshInstalled,
    filter: (query: string): FontCatalogGroup[] => filterFontCatalog(groups, query),
  };
}
