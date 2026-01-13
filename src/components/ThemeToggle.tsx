"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        applyTheme(saved);
      } else {
        setTheme("light");
        applyTheme("light");
      }
    } catch {
      // ignore
    }
  }, []);

  const nextTheme = useMemo<ThemeMode>(() => (theme === "dark" ? "light" : "dark"), [theme]);

  const onToggle = () => {
    const t = nextTheme;
    setTheme(t);
    applyTheme(t);
    try {
      window.localStorage.setItem("theme", t);
    } catch {
      // ignore
    }
  };

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button type="button" onClick={onToggle} className="w-full btn-secondary flex items-center justify-center gap-2">
      <Icon size={16} className="opacity-80" />
      <span className="text-sm">{label}</span>
    </button>
  );
}





