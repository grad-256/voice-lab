// 法務ドキュメントの公開 URL。
//
// Notion の公開ページで運用する方針（2026-04-20 決定）。PWA standalone モードでも
// PWA scope 外の URL なので `target="_blank"` で確実に外部ブラウザに開く。
// Masaru さんが Notion 側で編集し、デプロイ不要で更新できる運用を狙う。
// 以前あった内部ページ（app/[locale]/terms・privacy）はこの移行と同時に削除済み。
//
// ⚠️ URL の安定性が重要：Notion 側でページを移動 / 削除 / 公開解除すると 404 になる。
// Play Store / App Store にも本 URL を登録するため、変更する場合はストア掲載情報も更新すること。

export const LEGAL_URLS = {
  terms: "https://uclab.notion.site/348481455c788048a198fa9c6ae5176c",
  privacy: "https://uclab.notion.site/348481455c788072a6fffd124cac55fa",
} as const;
