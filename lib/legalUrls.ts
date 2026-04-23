// 法務ドキュメントの公開 URL（Notion 公開ページ運用、JA / EN 別ページ）。
//
// ⚠️ URL の安定性が重要：Notion 側でページを移動 / 削除 / 公開解除すると 404。
// Play Store / App Store にも本 URL を登録するため、変更時はストア掲載情報も更新すること。

type Locale = "ja" | "en";

const LEGAL_URLS_BY_LOCALE: Record<Locale, { terms: string; privacy: string }> = {
  ja: {
    terms: "https://uclab.notion.site/348481455c788048a198fa9c6ae5176c",
    privacy: "https://uclab.notion.site/348481455c788072a6fffd124cac55fa",
  },
  en: {
    terms: "https://uclab.notion.site/Terms-of-Service-34b481455c7880d08011faf27903f5f1",
    privacy: "https://uclab.notion.site/Privacy-Policy-34b481455c7880bc84e3fdd1fadcb288",
  },
};

/** ロケールに対応する法務ドキュメントの Notion URL を返す。未知のロケールは JA にフォールバック。 */
export function getLegalUrls(locale: string): { terms: string; privacy: string } {
  if (locale === "en") return LEGAL_URLS_BY_LOCALE.en;
  return LEGAL_URLS_BY_LOCALE.ja;
}

// 後方互換：既存の `LEGAL_URLS` 参照は JA 版にフォールバック。新規コードは `getLegalUrls(locale)` を使う。
export const LEGAL_URLS = LEGAL_URLS_BY_LOCALE.ja;
