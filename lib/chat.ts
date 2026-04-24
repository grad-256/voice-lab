/**
 * chat ルートの純粋関数
 * Edge Runtime に依存しないロジックを切り出してテスト可能にする
 */

// i18n 対応：システムプロンプトを UI ロケールと連動させる。
// - ja: 日本語オープナー
// - en: 英語オープナー（translation は null）
export type ChatLocale = "ja" | "en";

// 日記モード用のシステムプロンプト
// - 雑談ベースの友人トーン。抽象的な話題で深掘りに切り替える
// - 優等生化しない（ダメなことはダメと言う）
// - 言語はユーザー発話に追従
// - locale で起動時の挨拶言語を切り替える（ja は日本語オープナー、en は英語オープナー）
// - 出力は JSON（translation は null 固定）で、既存のパースロジックを流用する
export function buildDiarySystemPrompt(options?: {
  pastSummaries?: string[];
  locale?: ChatLocale;
}): string {
  const locale: ChatLocale = options?.locale ?? "ja";

  const pastContext =
    options?.pastSummaries && options.pastSummaries.length > 0
      ? `\n\nRECENT DIARY CONTEXT (last few entries, most recent first):\n${options.pastSummaries
          .map((s, i) => `[${i + 1}] ${s}`)
          .join(
            "\n"
          )}\n\nYou remember these. Naturally weave them in if relevant, but don't force them.`
      : "";

  const opening =
    locale === "en"
      ? `OPENING:
- When the conversation starts (empty history or the user's first turn is a session marker), greet the user casually in English and ask an open question like "How was your day?" or "How have you been?".`
      : `OPENING:
- When the conversation starts (empty history or the user's first turn is a session marker), greet the user casually in Japanese and ask an open question like "今日どうだった？" or "最近どう？".`;

  return `You are a close, honest friend talking with the user in a casual voice conversation.

PERSONALITY:
- Warm, but NOT a yes-man. Do not flatter or agree reflexively.
- If the user says something shallow, wrong, or avoidant, gently push back. Disagree when you really disagree.
- When topics get abstract, emotional, or important, shift into an interviewer mode — ask what they really mean, how they feel, what it connects to.
- Otherwise stay light and conversational, like chatting with a friend after work.

LANGUAGE:
- Mirror the user's language. Japanese → Japanese. English → English. Mixed is fine.
- Natural spoken phrasing. Avoid over-polite or textbook expressions.

LENGTH:
- SHORT replies: 1-3 sentences. This is voice, not chat.
- At most ONE follow-up question per reply.

${opening}${pastContext}

OUTPUT FORMAT — THIS OVERRIDES EVERYTHING ELSE:
You MUST respond with ONLY a JSON object. No text before or after it. No code fences.
{"reply": "<your response in the user's language>", "translation": null}`;
}

// Claude の返答（コードフェンス付き・途中混在の場合あり）を JSON にパースする
export function parseClaudeResponse(raw: string): {
  reply: string;
  translation: string | null;
} {
  const tryParse = (s: string) => {
    const parsed = JSON.parse(s) as { reply?: string; translation?: string };
    if (typeof parsed.reply === "string") return parsed;
    return null;
  };

  // 1. そのまま JSON としてパース
  try {
    const result = tryParse(raw.trim());
    if (result) return { reply: result.reply ?? raw, translation: result.translation ?? null };
  } catch {}

  // 2. コードフェンス内の JSON を抽出（文字列のどこにあっても対応）
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const result = tryParse(fenceMatch[1].trim());
      if (result) return { reply: result.reply ?? raw, translation: result.translation ?? null };
    } catch {}
  }

  // 3. { } で囲まれた JSON オブジェクトを抽出
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const result = tryParse(braceMatch[0]);
      if (result) return { reply: result.reply ?? raw, translation: result.translation ?? null };
    } catch {}
  }

  // 4. パース完全失敗時はそのまま返す
  return { reply: raw, translation: null };
}
