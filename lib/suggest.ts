/**
 * `/api/suggest` の純粋ロジック（mvp-scope.md 3.7 節 / Sprint 3）。
 *
 * Edge Runtime 本体（route.ts）から分離して単体テストしやすくする。
 * Sprint 4 で `recent_messages` / `timing` を入力拡張する際は本ファイルの型に
 * カラムを追加し、`/api/chat` には絶対に混入させない（決定事項 14）。
 */

export const SUGGEST_MODEL = "claude-haiku-4-5-20251001";

export type SuggestSource = "preset" | "user" | "suggest";

export interface SuggestPhrase {
  /** 安定 ID（PostHog 突合キー）。API 側で crypto.randomUUID で発行 */
  phrase_id: string;
  /** 日本語で「この英訳は何を言う意図か」を短く示す */
  ja_intent: string;
  /** 英訳本文（ElevenLabs にそのまま渡せる表記） */
  en_text: string;
  /** 突合用に正規化した英訳（lib/suggest.ts の normalizeEnglish で生成） */
  en_text_normalized: string;
}

export interface SuggestRequest {
  ja_text: string;
  persona_id?: string;
}

export interface SuggestResponse {
  phrases: SuggestPhrase[];
  /** ルールベースフォールバックで返した場合のみ true */
  fallback?: boolean;
}

// ────────────────────────────────────────────────
// normalizeEnglish（mvp-scope.md 4.5 節の最小版）
// Sprint 4 で縮約形辞書を拡張する前提。本 Sprint では Sprint 3 の保存時に
// 使える最低限の正規化を提供する。
// ────────────────────────────────────────────────

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
  [/\bit's\b/gi, "it is"],
  [/\bi'm\b/gi, "i am"],
  [/\byou're\b/gi, "you are"],
  [/\bthey're\b/gi, "they are"],
  [/\bwe're\b/gi, "we are"],
  [/\bi've\b/gi, "i have"],
  [/\bi'd\b/gi, "i would"],
  [/\bi'll\b/gi, "i will"],
  [/\blet's\b/gi, "let us"],
  [/\bthat's\b/gi, "that is"],
  [/\bthere's\b/gi, "there is"],
];

// 前後のアポストロフィ変種とダブルクオート変種を半角 ASCII に寄せる
const QUOTE_NORMALIZE: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u02BC]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
];

export function normalizeEnglish(text: string): string {
  if (typeof text !== "string") return "";
  let out = text;

  // 全角英数 → 半角
  out = out.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  // 全角スペース → 半角
  out = out.replace(/\u3000/g, " ");

  // クオート統一 → 縮約形展開（展開後に句読点除去するので順序重要）
  for (const [re, to] of QUOTE_NORMALIZE) out = out.replace(re, to);
  out = out.toLowerCase();
  for (const [re, to] of CONTRACTIONS) out = out.replace(re, to);

  // 句読点除去（最小辞書）
  out = out.replace(/[.,?!;:"']/g, "");

  // 連続空白を 1 個に統合 + 前後トリム
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

// ────────────────────────────────────────────────
// Claude Haiku 用プロンプト
// ────────────────────────────────────────────────

export function buildSuggestSystemPrompt(): string {
  return `You help a Japanese English learner translate what they wanted to say.
Given a short Japanese utterance, return 1 to 3 natural, conversational English phrases
that convey the same intent at an everyday spoken register.

STRICT OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no code fences:
{"phrases":[{"ja_intent":"<短い日本語の意図>","en_text":"<English phrase>"}]}

Rules:
- Each en_text MUST be one short sentence (under 15 words).
- Offer variety when multiple phrases: casual / polite / alternative phrasing.
- Do NOT include translations, explanations, or romaji outside the JSON.
- ja_intent is a concise Japanese label (under 20 chars) describing the intent nuance.`;
}

/**
 * Claude 応答から `phrases[]` を取り出す。parseClaudeResponse と同じ要領で、
 * コードフェンス付き / 文中混在にも耐えるフォールバック抽出を行う。
 * 整形失敗時は空配列を返し、呼び出し側でルールベースフォールバックへ。
 */
export function parseSuggestResponse(raw: string): Array<{ ja_intent: string; en_text: string }> {
  if (typeof raw !== "string" || raw.length === 0) return [];

  const tryParse = (s: string) => {
    try {
      const parsed = JSON.parse(s) as {
        phrases?: Array<{ ja_intent?: unknown; en_text?: unknown }>;
      };
      if (!Array.isArray(parsed.phrases)) return null;
      return parsed.phrases
        .map((p) => ({
          ja_intent: typeof p.ja_intent === "string" ? p.ja_intent : "",
          en_text: typeof p.en_text === "string" ? p.en_text : "",
        }))
        .filter((p) => p.en_text.length > 0)
        .slice(0, 3);
    } catch {
      return null;
    }
  };

  // そのまま
  const direct = tryParse(raw.trim());
  if (direct && direct.length > 0) return direct;

  // コードフェンス内
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inside = tryParse(fence[1].trim());
    if (inside && inside.length > 0) return inside;
  }

  // { } で囲まれた最初の JSON オブジェクト
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    const inside = tryParse(brace[0]);
    if (inside && inside.length > 0) return inside;
  }

  return [];
}

// ────────────────────────────────────────────────
// ルールベースフォールバック（3 フレーズ）
// Claude が落ちた時・応答が空のときに返す。
// 意図を絞らない汎用表現にして「とにかく動く」を担保する。
// ────────────────────────────────────────────────

const FALLBACK_PHRASES: Array<{ ja_intent: string; en_text: string }> = [
  { ja_intent: "伝えたいことを丁寧に言い直す", en_text: "Let me try to say that again." },
  { ja_intent: "言葉が出なかったと正直に伝える", en_text: "I could not find the words." },
  { ja_intent: "もう少し時間が欲しいと伝える", en_text: "Give me a moment to think." },
];

export function buildFallbackPhrases(): Array<{ ja_intent: string; en_text: string }> {
  return FALLBACK_PHRASES.map((p) => ({ ...p }));
}

// ────────────────────────────────────────────────
// 最終成形：phrase_id 付与 + 正規化テキスト付与
// ────────────────────────────────────────────────

/**
 * Claude / フォールバックの生データ（ja_intent + en_text）を API レスポンス形式の
 * SuggestPhrase[] に整える。phrase_id は発行関数（DI）経由で渡す（テスト容易性のため）。
 */
export function toSuggestPhrases(
  raw: Array<{ ja_intent: string; en_text: string }>,
  generateId: () => string
): SuggestPhrase[] {
  return raw.slice(0, 3).map((p) => ({
    phrase_id: generateId(),
    ja_intent: p.ja_intent,
    en_text: p.en_text,
    en_text_normalized: normalizeEnglish(p.en_text),
  }));
}
