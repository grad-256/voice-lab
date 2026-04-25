export const runtime = "edge";

import { anthropicEndpoint, gatewayAuthHeaders } from "@/lib/aiGateway";
import { createClient } from "@/lib/supabase/server";

// ────────────────────────────────────────────────
// 週間要約 API（Quiet プラン機能）
//
// GET  : 今週（月曜起算）の recap を返す。なければ { recap: null }
// POST : 今週の recap がなければ Sonnet 4.6 で生成して保存。既存なら即返す
// ────────────────────────────────────────────────

import { CLAUDE_SONNET } from "@/lib/models";

type Locale = "ja" | "en";

interface DiaryEntry {
  id: string;
  summary: string;
  language: string;
  created_at: string;
}

interface WeeklyRecap {
  id: string;
  user_id: string;
  week_start: string;
  summary: string;
  created_at: string;
}

interface AnthropicMessage {
  content: Array<{ type: string; text: string }>;
}

/** 今週月曜（UTC）の日付文字列を返す */
function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

// フリープランの振り返り対象件数。diary/route.ts の FREE_HISTORY_LIMIT と同値。
// 有料プラン導入時はここをプランで分岐し、Quiet は件数制限なし・今週分全件に変える。
const FREE_RECAP_LIMIT = 5;

/** entries の language 多数決で locale を決定する */
function detectLocale(entries: DiaryEntry[]): Locale {
  let enCount = 0;
  for (const entry of entries) {
    if (entry.language === "en") enCount++;
  }
  return enCount > entries.length / 2 ? "en" : "ja";
}

/** システムプロンプト（ja） */
function buildJaSystemPrompt(): string {
  return `あなたはユーザーの1週間の日記を振り返り、穏やかに語りかける存在です。

以下のルールを守って要約を書いてください：
- 200〜300文字で書く
- 第二人称（「あなたは」「あなたが」）で語りかける
- 評価・アドバイス・指摘はしない
- 出来事や気持ちをそのまま穏やかに反射する
- 最後は小さな前向きな言葉で締める
- 日本語で書く`;
}

/** システムプロンプト（en） */
function buildEnSystemPrompt(): string {
  return `You are a gentle presence that reflects on the user's week through their diary entries.

Follow these rules when writing the summary:
- Write 100 to 150 words
- Use second-person voice ("you", "your")
- Do not evaluate, advise, or criticize
- Reflect their experiences and feelings calmly and warmly
- Close with a gentle, quietly optimistic sentence
- Write in English`;
}

/** ユーザープロンプト（日記エントリから生成） */
function buildUserPrompt(entries: DiaryEntry[], locale: Locale): string {
  const entriesSummary = entries
    .map((e, i) => {
      const date = e.created_at.split("T")[0];
      return `[${i + 1}] ${date}\n${e.summary}`;
    })
    .join("\n\n");

  if (locale === "ja") {
    return `以下は私の今週の日記です。この内容を踏まえて、週間要約を書いてください。\n\n${entriesSummary}`;
  }
  return `Here are my diary entries from this week. Please write a weekly summary based on these.\n\n${entriesSummary}`;
}

/** Sonnet 4.6 で週間要約テキストを生成する */
async function generateSummary(entries: DiaryEntry[], locale: Locale): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const endpoint = anthropicEndpoint("messages");

  const systemPrompt = locale === "ja" ? buildJaSystemPrompt() : buildEnSystemPrompt();
  const userPrompt = buildUserPrompt(entries, locale);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      ...gatewayAuthHeaders(),
    },
    body: JSON.stringify({
      model: CLAUDE_SONNET,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anthropic API エラー: ${response.status} ${text}`);
  }

  const data = (await response.json()) as AnthropicMessage;
  const content = data.content?.[0];
  if (!content || content.type !== "text" || typeof content.text !== "string") {
    throw new Error("Anthropic API からのレスポンス形式が不正です");
  }

  return content.text.trim();
}

// ────────────────────────────────────────────────
// GET: 今週の recap を返す
//      ?history=true の場合は全件一覧を week_start 降順で返す
// ────────────────────────────────────────────────
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(req.url);
  const isHistory = url.searchParams.get("history") === "true";

  // ── 一覧モード（?history=true）──
  if (isHistory) {
    const { data, error } = await supabase
      .from("weekly_recaps")
      .select("id, user_id, week_start, summary, created_at")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(52); // 最大1年分

    if (error) {
      console.error("weekly_recap history GET error:", error);
      return Response.json({ error: "取得に失敗しました" }, { status: 500 });
    }

    return Response.json({ recaps: (data ?? []) as WeeklyRecap[] });
  }

  // ── 今週モード（デフォルト）──
  const weekStart = getWeekStart();

  const { data, error } = await supabase
    .from("weekly_recaps")
    .select("id, user_id, week_start, summary, created_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle<WeeklyRecap>();

  if (error) {
    console.error("weekly_recap GET error:", error);
    return Response.json({ error: "取得に失敗しました" }, { status: 500 });
  }

  return Response.json({ recap: data ?? null });
}

// ────────────────────────────────────────────────
// POST: 今週の recap を生成して保存する
// ────────────────────────────────────────────────
export async function POST(_req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const weekStart = getWeekStart();

  // 1. 既存の recap があれば即返す（二重生成防止）
  const { data: existing, error: existingError } = await supabase
    .from("weekly_recaps")
    .select("id, user_id, week_start, summary, created_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle<WeeklyRecap>();

  if (existingError) {
    console.error("weekly_recap existing check error:", existingError);
    return Response.json({ error: "データの確認に失敗しました" }, { status: 500 });
  }

  if (existing) {
    return Response.json({ recap: existing });
  }

  // 2. diary_entries から直近5件を取得（フリープラン）
  // Quiet プラン導入時は week_start から today までの全件に切り替えること。
  const { data: entries, error: entriesError } = await supabase
    .from("diary_entries")
    .select("id, summary, language, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(FREE_RECAP_LIMIT);

  if (entriesError) {
    console.error("diary_entries fetch error:", entriesError);
    return Response.json({ error: "日記の取得に失敗しました" }, { status: 500 });
  }

  const diaryEntries = ((entries ?? []) as DiaryEntry[]).reverse();

  // 3. entries が0件なら 400
  if (diaryEntries.length === 0) {
    return Response.json({ error: "今週の日記がまだありません" }, { status: 400 });
  }

  // 4. locale 決定
  const locale = detectLocale(diaryEntries);

  // 5. Sonnet 4.6 で要約生成
  let summary: string;
  try {
    summary = await generateSummary(diaryEntries, locale);
  } catch (e) {
    console.error("weekly_recap generation error:", e);
    return Response.json({ error: "要約の生成に失敗しました" }, { status: 500 });
  }

  // 6. weekly_recaps に upsert して返す
  const { data: upserted, error: upsertError } = await supabase
    .from("weekly_recaps")
    .upsert(
      { user_id: user.id, week_start: weekStart, summary },
      { onConflict: "user_id,week_start" }
    )
    .select("id, user_id, week_start, summary, created_at")
    .single<WeeklyRecap>();

  if (upsertError || !upserted) {
    console.error("weekly_recap upsert error:", upsertError);
    return Response.json({ error: "要約の保存に失敗しました" }, { status: 500 });
  }

  return Response.json({ recap: upserted });
}
