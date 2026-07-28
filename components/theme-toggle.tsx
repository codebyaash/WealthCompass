"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

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

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: AppTheme =
      storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";

    setTheme(initialTheme);
    applyThemeToDocument(initialTheme);
  }, [mounted]);

  const isDark = mounted && theme === "dark";

  const handleToggleTheme = () => {
    const nextTheme: AppTheme = isDark ? "light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyThemeToDocument(nextTheme);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("rounded-lg", className)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={handleToggleTheme}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  );
}
