"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildFontCatalog,
  filterFontCatalog,
  setInstalledFontOptions,
  type FontCatalogGroup,
  type FontFamilyOption,
} from "./fontCatalog";
import { localFontsSupported, queryInstalledFontOptions } from "./localFonts";

export function useFontCatalog() {
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

  const groups = useMemo(() => buildFontCatalog(installed), [installed]);

  return {
    groups,
    installed,
    localStatus,
    localFontsSupported: localFontsSupported(),
    refreshInstalled,
    filter: (query: string): FontCatalogGroup[] => filterFontCatalog(groups, query),
  };
}
