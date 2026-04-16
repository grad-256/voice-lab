export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";

// 声の日記エントリの CRUD（編集は MVP 範囲外）。
// RLS で本人のレコードだけ参照・挿入・削除できる前提。認証必須。

type TranscriptItem = { role: "user" | "assistant"; text: string };
type Language = "ja" | "en" | "mixed";

interface PostBody {
  title?: unknown;
  summary?: unknown;
  transcript?: unknown;
  language?: unknown;
  message_count?: unknown;
}

const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 100;
const MAX_TITLE_LENGTH = 160;
const MAX_SUMMARY_LENGTH = 4000;
const MAX_TRANSCRIPT_LENGTH = 500; // 1 会話あたり最大ターン数（現実的な上限）
const MAX_TEXT_PER_TURN = 4000; // 1 ターンあたりの最大文字数（ストレージ浪費対策）

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ error: "リクエスト本文の解析に失敗しました" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const summary =
    typeof body.summary === "string" ? body.summary.trim().slice(0, MAX_SUMMARY_LENGTH) : "";
  const transcript = Array.isArray(body.transcript)
    ? body.transcript
        .filter(isTranscriptItem)
        .slice(0, MAX_TRANSCRIPT_LENGTH)
        .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_TEXT_PER_TURN) }))
    : null;
  const language: Language =
    body.language === "en" ? "en" : body.language === "mixed" ? "mixed" : "ja";
  const messageCount =
    typeof body.message_count === "number" && Number.isFinite(body.message_count)
      ? Math.max(0, Math.floor(body.message_count))
      : 0;

  if (!title) return Response.json({ error: "title は必須です" }, { status: 400 });
  if (!summary) return Response.json({ error: "summary は必須です" }, { status: 400 });
  if (!transcript || transcript.length === 0) {
    return Response.json({ error: "transcript は必須です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      user_id: user.id,
      title,
      summary,
      transcript,
      language,
      message_count: messageCount,
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();

  if (error || !data) {
    console.error("diary insert error:", error);
    return Response.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  return Response.json({ id: data.id, created_at: data.created_at });
}

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
  const limitParam = url.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(LIST_MAX_LIMIT, Math.max(1, parsedLimit))
    : LIST_DEFAULT_LIMIT;

  const { data, error } = await supabase
    .from("diary_entries")
    .select("id, title, summary, language, message_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("diary list error:", error);
    return Response.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  return Response.json({ items: data ?? [] });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id は必須です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "22P02") {
      return Response.json({ error: "id の形式が不正です" }, { status: 400 });
    }
    console.error("diary delete error:", error);
    return Response.json({ error: "削除に失敗しました" }, { status: 500 });
  }
  // RLS により他ユーザー行は delete 対象から外れる → 0 件 = 見つからない扱い
  if (!data || data.length === 0) {
    return Response.json({ error: "対象が見つかりません", code: "NOT_FOUND" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

function isTranscriptItem(x: unknown): x is TranscriptItem {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as { role?: unknown; text?: unknown };
  return (
    (obj.role === "user" || obj.role === "assistant") && typeof obj.text === "string"
  );
}
