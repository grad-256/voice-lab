export const runtime = "edge";

/**
 * `/api/suggest` — 日本語テキストから英訳候補を生成する（mvp-scope.md 3.7 節 / Sprint 3）。
 *
 * - Claude Sonnet 4.5 (`claude-sonnet-4-5`) を利用（Sprint 5 後に Haiku から昇格・文脈適合度を優先）。
 * - 障害時（ネットワーク・5xx・429・JSON 破損）は `lib/suggest` のルールベースフォールバック 3 件。
 * - Sprint 4 で `recent_messages` / `timing` を入力拡張する前提。
 * - `/api/chat` への混入は禁止（決定事項 14 / mvp-scope.md 3.9）。
 */

import {
  SUGGEST_MODEL,
  type SuggestPhrase,
  type SuggestRecentMessage,
  type SuggestRequest,
  type SuggestResponse,
  type SuggestTiming,
  buildFallbackPhrases,
  buildSuggestSystemPrompt,
  buildSuggestUserContent,
  parseSuggestResponse,
  toSuggestPhrases,
} from "@/lib/suggest";

const MAX_JA_LENGTH = 400;
const ALLOWED_TIMINGS: ReadonlySet<SuggestTiming> = new Set(["before_chat", "during_chat"]);

function sanitizeRecentMessages(raw: unknown): SuggestRecentMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SuggestRecentMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    if (content.length === 0) continue;
    out.push({ role, content });
  }
  return out.length > 0 ? out : null;
}

function respondWithFallback(): SuggestResponse {
  const phrases = toSuggestPhrases(buildFallbackPhrases(), () => crypto.randomUUID());
  return { phrases, fallback: true };
}

export async function POST(req: Request) {
  let body: Partial<SuggestRequest>;
  try {
    body = (await req.json()) as Partial<SuggestRequest>;
  } catch {
    return Response.json({ error: "リクエスト本文の解析に失敗しました" }, { status: 400 });
  }

  const jaText = typeof body.ja_text === "string" ? body.ja_text.trim() : "";
  const timingRaw = typeof body.timing === "string" ? (body.timing as SuggestTiming) : undefined;
  const timing = timingRaw && ALLOWED_TIMINGS.has(timingRaw) ? timingRaw : undefined;
  const recentMessages = sanitizeRecentMessages(body.recent_messages);

  // サジェスト成立条件（Sprint 4 で拡張）：
  //   - `before_chat` はオープナー生成で ja_text 不要
  //   - `during_chat` は recent_messages があれば次発話ヒント生成が成立（ja_text 不要）
  //   - timing 未指定（モーダル経路）は従来どおり ja_text 必須
  //   - 上記いずれでもヒント情報がゼロなら 400
  const hasRecent = Boolean(recentMessages && recentMessages.length > 0);
  const canOpener = timing === "before_chat";
  const canContinue = timing === "during_chat" && hasRecent;
  const canTranslate = jaText.length > 0;
  if (!canOpener && !canContinue && !canTranslate) {
    return Response.json({ error: "ja_text または recent_messages が必要です" }, { status: 400 });
  }
  if (jaText.length > MAX_JA_LENGTH) {
    return Response.json({ error: "ja_text が長すぎます" }, { status: 400 });
  }

  const personaId = typeof body.persona_id === "string" ? body.persona_id.slice(0, 64) : null;

  // Claude Haiku 呼び出し。失敗時はフォールバック。
  let rawPhrases: Array<{ ja_intent: string; en_text: string }> = [];
  try {
    const userContent = buildSuggestUserContent({
      jaText,
      personaId,
      recentMessages,
      timing,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SUGGEST_MODEL,
        max_tokens: 512,
        system: buildSuggestSystemPrompt(timing),
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      // 429 / 529 は上位の quota バナー経路に乗せたいが、Sprint 3 の最小実装では
      // フォールバックで動作を担保する（UX 優先）。ステータスはログに残す。
      console.warn("suggest upstream non-ok:", response.status);
    } else {
      const data = (await response.json()) as {
        content?: { type: string; text: string }[];
      };
      const raw = data.content?.[0]?.text ?? "";
      rawPhrases = parseSuggestResponse(raw);
      if (rawPhrases.length === 0) {
        console.warn("suggest parse failed, using fallback");
      }
    }
  } catch (err) {
    console.error("suggest upstream error:", err);
  }

  if (rawPhrases.length === 0) {
    return Response.json(respondWithFallback());
  }

  const phrases: SuggestPhrase[] = toSuggestPhrases(rawPhrases, () => crypto.randomUUID());
  const result: SuggestResponse = { phrases };
  return Response.json(result);
}
