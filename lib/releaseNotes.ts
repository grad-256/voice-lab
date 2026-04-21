// リリースノートのバージョン順序だけを型付き定数として保持する。
// 本文（バージョン番号・日付・タイトル・項目）は i18n JSON (`releaseNotes.entries.*`) 側に置き、
// ページは `RELEASE_NOTES.map(key => t(\`entries.${key}.*\`))` で引く。
// 将来 MDX 等に切り替える場合はこのモジュールを差し替えれば済む。

export type ReleaseNoteKey = "v1_2_0" | "v1_1_0" | "v1_0_0";

// 新しい順に並べる。ページ側は配列の順序のままレンダリングする。
export const RELEASE_NOTES: readonly ReleaseNoteKey[] = ["v1_2_0", "v1_1_0", "v1_0_0"];
