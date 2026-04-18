import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

// 対応ロケール一覧。追加時はここに並べるだけで各機能が連動する想定。
export const routing = defineRouting({
  locales: ["ja", "en"],
  defaultLocale: "ja",
  // デフォルトロケール（ja）の URL はプリフィクスなしで維持（例：/echo は変わらず）
  // 英語のみ /en プリフィクスが付く（例：/en/echo）
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

// ロケールを意識した Link / useRouter / redirect / usePathname。
// 画面遷移・クライアント側ルーティングではこちらを使い、現在のロケールを保持する。
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
