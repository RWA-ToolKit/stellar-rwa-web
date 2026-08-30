"use client";

/**
 * Theme management: dark / light / system (follows OS prefers-color-scheme).
 *
 * The resolved class ("dark" or nothing) is applied to <html> by
 * ThemeProvider. `useTheme` exposes the current preference and a setter so
 * any component can render a toggle.
 *
 * Persistence: preference is stored in localStorage under "rwa.theme".
 * Default: "system" — respects the user's OS setting out of the box.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "dark" | "light" | "system";

interface ThemeContextValue {
  /** What the user has explicitly chosen (or "system" if no preference stored). */
  preference: ThemePreference;
  /** The theme that is actually active after resolving "system". */
  resolved: "dark" | "light";
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "rwa.theme";

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}

function resolvePreference(
  pref: ThemePreference,
  mediaPrefersDark: boolean,
): "dark" | "light" {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  return mediaPrefersDark ? "dark" : "light";
}

/**
 * Renders the theme-class-setting script inline before React hydration so
 * there's no flash of wrong theme on first paint. Must be placed inside
 * <head> or at the very start of <body>.
 */
export function ThemeScript() {
  // This script runs synchronously before React to set the `dark` class.
  const script = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var dark=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})();`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline script for theme initialization
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [mediaPrefersDark, setMediaPrefersDark] = useState(false);

  // Hydrate from localStorage + detect OS preference on mount.
  useEffect(() => {
    const pref = readPreference();
    setPreferenceState(pref);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setMediaPrefersDark(mq.matches);

    function onChange(e: MediaQueryListEvent) {
      setMediaPrefersDark(e.matches);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = resolvePreference(preference, mediaPrefersDark);

  // Apply the `dark` class to <html> whenever the resolved theme changes.
  useEffect(() => {
    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Storage may be blocked in private browsing; non-fatal.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
