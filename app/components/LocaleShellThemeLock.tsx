"use client";

import { usePathname } from "@/i18n/routing";
import {
  applyResolvedTheme,
  getStoredLpThemePreference,
  getStoredThemePreference,
  resolveTheme,
} from "@/lib/theme";
import { useEffect } from "react";

/**
 * LP ⇄ アプリを跨いだとき、対応する localStorage キーからテーマを再解決する。
 * LP は `lp_theme_preference`、それ以外は `theme_preference`。連動させない。
 */
export function LocaleShellThemeLock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  useEffect(() => {
    const preference = isLanding ? getStoredLpThemePreference() : getStoredThemePreference();
    applyResolvedTheme(resolveTheme(preference));
  }, [isLanding]);

  return <div className="flex-1 flex flex-col">{children}</div>;
}
