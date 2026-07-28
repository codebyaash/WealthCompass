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

type AppTheme = "light" | "dark";

type ThemeContextValue = {
  resolvedTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  theme: AppTheme;
};

const THEME_STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDocument(theme: AppTheme) {
  const root = document.documentElement;
  const body = document.body;

  root.dataset.theme = theme;
  body.dataset.theme = theme;

  if (theme === "dark") {
    root.classList.add("dark");
    body.classList.add("dark");
  } else {
    root.classList.remove("dark");
    body.classList.remove("dark");
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: ReactNode;
  defaultTheme?: AppTheme;
}) {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : defaultTheme;

    setThemeState(initialTheme);
    applyThemeToDocument(initialTheme);
  }, [defaultTheme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyThemeToDocument(nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme: theme,
      setTheme,
      theme,
    }),
    [setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
