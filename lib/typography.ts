// ブランド標準のフォントスタック。個別ファイルで重複定義せず、必ずここから import する。
//
// - Latin は next/font 由来の CSS 変数を使い、和文は同じく next/font で読み込んでいる変数
//   （Noto Sans JP / Shippori Mincho）にフォールバックさせる。
//   "Noto Sans JP" や "Shippori Mincho" のような文字列リテラルは next/font では obscured な
//   family 名で読み込まれるため参照できず、var(--font-sans-jp) / var(--font-serif-jp) を介す必要がある。
// - Fraunces + Shippori Mincho は Chapter 系譜の見出し・装飾語で使う欧文セリフ stack。
// - JetBrains Mono は 2026-04-21 に廃止（当時の Plus Jakarta Sans / Fraunces と声の高さが揃わなかったため。
//   sans を Inter に差し替えた後も mono は復活させず、等幅リズムは CSS 側 `.font-mono-jp`
//   クラス＝ tabular-nums + letter-spacing に寄せる方針）。
//   旧 MONO_FAMILY は互換のため sans と同一 stack に退化させている。

export const SANS_FAMILY = "var(--font-sans), var(--font-sans-jp), sans-serif";

export const SERIF_FAMILY =
  'var(--font-serif), var(--font-serif-jp), "YuMincho", "Hiragino Mincho ProN", serif';

// 旧 mono 互換：現在は sans と同じ stack。callsite の名前だけ残すために export する。
export const MONO_FAMILY = SANS_FAMILY;
