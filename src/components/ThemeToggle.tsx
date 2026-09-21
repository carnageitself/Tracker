"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { BTN_ICON } from "./ui";

type Theme = "light" | "dark";

export const THEME_KEY = "lead-tracker:theme";

/** Runs before paint in <head> so a stored theme never flashes the other mode. */
export const themeBootstrap = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`;

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const stamped = document.documentElement.dataset.theme;
  if (stamped === "light" || stamped === "dark") return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const hydrated = useHydrated();
  const [theme, setTheme] = useState<Theme>(readTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage failures just make the choice session-only.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        hydrated
          ? `Switch to ${theme === "dark" ? "light" : "dark"} mode`
          : "Toggle theme"
      }
      className={BTN_ICON}
    >
      {/* Empty until hydrated — the real value is only known in the browser. */}
      <span aria-hidden>{hydrated ? (theme === "dark" ? "☀" : "☾") : ""}</span>
    </button>
  );
}
