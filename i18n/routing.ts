import { defineRouting } from "next-intl/routing";

// 対応ロケール一覧。追加時はここに並べるだけで各機能が連動する想定。
export const routing = defineRouting({
  locales: ["ja", "en"],
  defaultLocale: "ja",
  // /ja 以外（現状の日本語ルート）へのアクセスを保つため、デフォルトロケールは URL プリフィクスなし
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
