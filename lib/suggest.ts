/**
 * `/api/suggest` の純粋ロジック（mvp-scope.md 3.7 節 / Sprint 3 新設 / Sprint 4 拡張）。
 *
 * Edge Runtime 本体（route.ts）から分離して単体テストしやすくする。
 * `/api/chat` には絶対に混入させない（決定事項 14）。
 *
 * Sprint 4 変更点：
 * - `recent_messages` / `timing` を入力型に追加（後方互換。未指定でも動作）。
 * - `normalizeEnglish` は `lib/normalizeEnglish.ts` に昇格。ここでは re-export のみ。
 */

import { normalizeEnglish } from "./normalizeEnglish";

export { normalizeEnglish };

// Sprint 5 後：文脈適合度を優先して Sonnet 4.5 に昇格（/api/chat は Haiku 据え置き）
export const SUGGEST_MODEL = "claude-sonnet-4-5";

export type SuggestTiming = "before_chat" | "during_chat";

export interface SuggestRecentMessage {
  role: "user" | "assistant";
  content: string;
}

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
  /**
   * Sprint 3 では必須。Sprint 4 以降、会話前サジェスト（`timing: "before_chat"`）で
   * 起点日本語がない場合に空文字を許容する。
   */
  ja_text: string;
  persona_id?: string;
  /** Sprint 4: 会話前 / 中のサジェスト文脈（最新 N ターン、N は API 側で頭打ち） */
  recent_messages?: SuggestRecentMessage[];
  /** Sprint 4: サジェストの出現タイミング。未指定時はモーダル用の汎用生成 */
  timing?: SuggestTiming;
}

export interface SuggestResponse {
  phrases: SuggestPhrase[];
  /** ルールベースフォールバックで返した場合のみ true */
  fallback?: boolean;
}

// ────────────────────────────────────────────────
// Claude Haiku 用プロンプト
// ────────────────────────────────────────────────

export function buildSuggestSystemPrompt(timing?: SuggestTiming): string {
  if (timing === "before_chat") {
    return `You help a Japanese English learner prepare useful phrases BEFORE a conversation.
Suggest 3 natural English phrases the learner might want to say at the start of the conversation,
given the conversation partner persona (if provided).

STRICT OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no code fences:
{"phrases":[{"ja_intent":"<短い日本語の意図>","en_text":"<English phrase>"}]}

Rules:
- Return exactly 3 phrases covering variety (greeting / question / response hook).
- Each en_text MUST be one short sentence (under 15 words).
- ja_intent is a concise Japanese label (under 20 chars) describing the intent.
- Do NOT include romaji, explanations, or any text outside the JSON.`;
  }
  if (timing === "during_chat") {
    return `You help a Japanese English learner continue an ongoing conversation in English.
Given the recent exchange, suggest 1 to 3 natural English phrases the learner could say next.

STRICT OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no code fences:
{"phrases":[{"ja_intent":"<短い日本語の意図>","en_text":"<English phrase>"}]}

Rules:
- Each en_text MUST be one short sentence (under 15 words) that naturally follows the assistant's last turn.
- Offer variety: agree / ask follow-up / change topic gently.
- ja_intent is a concise Japanese label (under 20 chars).
- Do NOT include romaji, explanations, or any text outside the JSON.`;
  }
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
 * Claude に渡す user content を組み立てる（Sprint 4）。
 *
 * - `timing` 別にヘッダーを切り替える
 * - `recent_messages` は末尾 N 件のみ、1 メッセージあたり 200 文字で打ち切り（トークン浪費と PII 流出の抑制）
 * - `persona_id` はヒントとして末尾に添える（system prompt には載せない）
 */
const MAX_RECENT_MESSAGES = 6;
const MAX_RECENT_MESSAGE_CHARS = 200;

export function buildSuggestUserContent(input: {
  jaText: string;
  personaId?: string | null;
  recentMessages?: SuggestRecentMessage[] | null;
  timing?: SuggestTiming;
}): string {
  const { jaText, personaId, recentMessages, timing } = input;
  const parts: string[] = [];

  if (personaId) {
    parts.push(`Persona hint: ${personaId}`);
  }

  if (recentMessages && recentMessages.length > 0) {
    const recent = recentMessages
      .slice(-MAX_RECENT_MESSAGES)
      .map((m) => {
        const content =
          typeof m.content === "string" ? m.content.slice(0, MAX_RECENT_MESSAGE_CHARS) : "";
        const role = m.role === "assistant" ? "assistant" : "user";
        return `${role}: ${content}`;
      })
      .join("\n");
    parts.push(`Recent conversation:\n${recent}`);
  }

  if (timing === "before_chat") {
    parts.push("Context: The learner is about to start this conversation. Suggest opener phrases.");
  } else if (timing === "during_chat") {
    parts.push(
      "Context: The learner wants the next line to say. Suggest phrases that follow the assistant's last turn."
    );
  }

  if (jaText.length > 0) {
    parts.push(`Japanese utterance:\n${jaText}`);
  }

  return parts.join("\n\n");
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
