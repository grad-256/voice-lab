/**
 * 英文正規化（mvp-scope.md 4.5 節 / Sprint 4）。
 *
 * `phrase_used_in_chat` の突合キーとして、ユーザー発話と再生フレーズの
 * `en_text_normalized` を等値比較できるよう、次の処理を行う。
 *
 * - 全角英数・全角スペース → 半角
 * - ユニコードのアポストロフィ / ダブルクオートを ASCII に統一
 * - 小文字化
 * - 縮約形展開（最小辞書）
 * - 句読点除去
 * - 連続空白統合 + 前後トリム
 *
 * Sprint 3 までは `lib/suggest.ts` 内に最小版が同居していたが、Sprint 4 で
 * 本ファイルに昇格・単独テスト対象化した（保存時と突合時の双方で同じロジック）。
 */

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bcan't\b/gi, "can not"],
  [/\bwon't\b/gi, "will not"],
  [/\bdon't\b/gi, "do not"],
  [/\bdidn't\b/gi, "did not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bisn't\b/gi, "is not"],
  [/\baren't\b/gi, "are not"],
  [/\bwasn't\b/gi, "was not"],
  [/\bweren't\b/gi, "were not"],
  [/\bhasn't\b/gi, "has not"],
  [/\bhaven't\b/gi, "have not"],
  [/\bhadn't\b/gi, "had not"],
  [/\bshouldn't\b/gi, "should not"],
  [/\bcouldn't\b/gi, "could not"],
  [/\bwouldn't\b/gi, "would not"],
  [/\bit's\b/gi, "it is"],
  [/\bi'm\b/gi, "i am"],
  [/\byou're\b/gi, "you are"],
  [/\bthey're\b/gi, "they are"],
  [/\bwe're\b/gi, "we are"],
  [/\bi've\b/gi, "i have"],
  [/\byou've\b/gi, "you have"],
  [/\bthey've\b/gi, "they have"],
  [/\bwe've\b/gi, "we have"],
  [/\bi'd\b/gi, "i would"],
  [/\byou'd\b/gi, "you would"],
  [/\bi'll\b/gi, "i will"],
  [/\byou'll\b/gi, "you will"],
  [/\blet's\b/gi, "let us"],
  [/\bthat's\b/gi, "that is"],
  [/\bthere's\b/gi, "there is"],
  [/\bhe's\b/gi, "he is"],
  [/\bshe's\b/gi, "she is"],
  [/\bwhat's\b/gi, "what is"],
];

const QUOTE_NORMALIZE: Array<[RegExp, string]> = [
  // U+2018 LEFT SINGLE QUOTATION MARK / U+2019 RIGHT SINGLE QUOTATION MARK /
  // U+02BC MODIFIER LETTER APOSTROPHE
  [/[\u2018\u2019\u02BC]/g, "'"],
  // U+201C LEFT DOUBLE QUOTATION MARK / U+201D RIGHT DOUBLE QUOTATION MARK
  [/[\u201C\u201D]/g, '"'],
];

export function normalizeEnglish(text: string): string {
  if (typeof text !== "string") return "";
  let out = text;

  // 全角英数 → 半角（U+FF01〜U+FF5E を 0x20 系にシフト）
  out = out.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  out = out.replace(/\u3000/g, " ");

  for (const [re, to] of QUOTE_NORMALIZE) out = out.replace(re, to);
  out = out.toLowerCase();
  for (const [re, to] of CONTRACTIONS) out = out.replace(re, to);

  // 句読点除去（4.5 節最小辞書）
  out = out.replace(/[.,?!;:"']/g, "");

  out = out.replace(/\s+/g, " ").trim();
  return out;
}
