"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyResolvedTheme,
  applyThemePreference,
  readThemePreference,
  resolveTheme,
  subscribeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): { preference: ThemePreference; resolved: "light" | "dark" } {
  if (typeof window === "undefined") {
    return { preference: "system", resolved: "light" };
  }
  const preference = readThemePreference();
  const resolved = resolveTheme(preference);
  return { preference, resolved };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readInitialTheme().preference,
  );
  const [resolved, setResolved] = useState<"light" | "dark">(() => readInitialTheme().resolved);

  const syncFromStorage = useCallback(() => {
    const pref = readThemePreference();
    const r = resolveTheme(pref);
    setPreferenceState(pref);
    setResolved(r);
    applyResolvedTheme(r);
  }, []);

  useEffect(() => {
    syncFromStorage();
    return subscribeThemePreference(syncFromStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme("system");
      setResolved(next);
      applyResolvedTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    setPreferenceState(next);
    setResolved(resolveTheme(next));
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
