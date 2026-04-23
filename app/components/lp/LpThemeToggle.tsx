"use client";

import { type ResolvedTheme, applyResolvedTheme, setStoredLpThemePreference } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

// LP 専用テーマトグル。`lp_theme_preference` にのみ書き込む（アプリ側とは連動しない）。
export function LpThemeToggle() {
  const t = useTranslations("lp.theme");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setResolved(current);
  }, []);

  const handleToggle = () => {
    const next: ResolvedTheme = resolved === "dark" ? "light" : "dark";
    setStoredLpThemePreference(next);
    applyResolvedTheme(next);
    setResolved(next);
  };

  const ariaLabel = resolved === "dark" ? t("toggleToLight") : t("toggleToDark");
  const Icon = resolved === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={ariaLabel}
      className="flex items-center justify-center h-[34px] w-[34px] border-[0.5px] border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
