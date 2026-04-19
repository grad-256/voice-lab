"use client";

import { usePathname } from "@/i18n/routing";
import { applyResolvedTheme, getStoredThemePreference, resolveTheme } from "@/lib/theme";
import { useEffect } from "react";

/**
 * LP ルート時だけテーマをダークに固定するためのクライアント側ラッパー。
 *
 * 方針：
 *   - LP は常にブランドトーンのダークで見せたいため、html 要素自体の data-theme を dark に上書きする。
 *     （subtree だけに data-theme="dark" を付ける方式では、body の bg 等が html の light 値で
 *      解決されてしまうケースがあったため、html 直接上書きの方がシンプルで確実。）
 *   - LP を離れるときは、localStorage に保存されたユーザー選択を「再解決」して適用する。
 *     直前の html dataset 値（LP 進入時は THEME_INIT_SCRIPT で既に "dark" になっている）を
 *     そのまま戻すと、ユーザーが light を選んでいても LP 経由で強制 dark になる回帰が起きるため、
 *     必ず保存値から再計算する。
 *   - children + footer をそのまま通すためのレイアウトラッパー（flex-1 flex flex-col）も兼ねる。
 */
export function LocaleShellThemeLock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  useEffect(() => {
    if (!isLanding) return;
    document.documentElement.dataset.theme = "dark";
    return () => {
      // ユーザー選択（localStorage）を再解決して適用する。"dark" の踏み潰しを避ける。
      applyResolvedTheme(resolveTheme(getStoredThemePreference()));
    };
  }, [isLanding]);

  return <div className="flex-1 flex flex-col">{children}</div>;
}
