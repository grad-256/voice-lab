export const runtime = "edge";

import { normalizeEnglish } from "@/lib/suggest";
import { createClient } from "@/lib/supabase/server";

/**
 * `/api/saved-phrases` — 「これ言えなかった」モーダル・サジェスト・プリセット場面から保存されたフレーズ。
 *
 * mvp-scope.md 3.7 節 / Sprint 3 で POST 新設、Sprint 5 で GET / DELETE 追加：
 *   - 認証必須（ゲストは呼ばない。クライアント側でログイン導線を出す）
 *   - source は 'preset' | 'user' | 'suggest'
 *   - en_text_normalized は `lib/suggest.normalizeEnglish` で生成
 *   - RLS：auth.uid() = user_id（GET / DELETE も RLS 依存で他ユーザー行にはアクセス不可）
 */

type Source = "preset" | "user" | "suggest";
const VALID_SOURCES: Source[] = ["preset", "user", "suggest"];

const MAX_EN_LENGTH = 500;
const MAX_JA_LENGTH = 500;
const MAX_PHRASE_ID_REF_LENGTH = 64;
// 一覧は新しい順に上限 100 件。MVP では 1 ユーザーあたり数十件想定のため十分。
const LIST_LIMIT = 100;

interface PostBody {
  ja_text?: unknown;
  en_text?: unknown;
  source?: unknown;
  phrase_id_ref?: unknown;
}

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

  const enText = typeof body.en_text === "string" ? body.en_text.trim() : "";
  if (enText.length === 0 || enText.length > MAX_EN_LENGTH) {
    return Response.json({ error: "en_text は必須です（500 字以内）" }, { status: 400 });
  }

  const jaText =
    typeof body.ja_text === "string" ? body.ja_text.trim().slice(0, MAX_JA_LENGTH) : null;

  const source = typeof body.source === "string" ? (body.source as Source) : "user";
  if (!VALID_SOURCES.includes(source)) {
    return Response.json({ error: "source が不正です" }, { status: 400 });
  }

  const phraseIdRef =
    typeof body.phrase_id_ref === "string"
      ? body.phrase_id_ref.slice(0, MAX_PHRASE_ID_REF_LENGTH)
      : null;

  const enTextNormalized = normalizeEnglish(enText);
  if (enTextNormalized.length === 0) {
    return Response.json({ error: "en_text の正規化に失敗しました" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_phrases")
    .insert({
      user_id: user.id,
      ja_text: jaText,
      en_text: enText,
      en_text_normalized: enTextNormalized,
      source,
      phrase_id_ref: phraseIdRef,
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();

  if (error) {
    // Postgres unique violation（同一 user_id + en_text_normalized で保存済み）
    if (error.code === "23505") {
      return Response.json({ error: "既に保存済みです", code: "ALREADY_SAVED" }, { status: 409 });
    }
    console.error("saved-phrases insert error:", error);
    return Response.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  if (!data) {
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
  const sourceParam = url.searchParams.get("source");
  // source 指定は許可値のみ受ける。不正値は 400（silent 無視にすると UI のバグを隠してしまう）。
  if (sourceParam !== null && !VALID_SOURCES.includes(sourceParam as Source)) {
    return Response.json({ error: "source が不正です" }, { status: 400 });
  }

  let query = supabase
    .from("saved_phrases")
    .select("id, ja_text, en_text, source, phrase_id_ref, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (sourceParam) {
    query = query.eq("source", sourceParam);
  }

  const { data, error } = await query;
  if (error) {
    console.error("saved-phrases list error:", error);
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
  // UUID 厳密検証までは不要（Postgres 側で 22P02 を返すため）。空のみ弾く。
  if (!id || id.length === 0) {
    return Response.json({ error: "id は必須です" }, { status: 400 });
  }

  const { data, error } = await supabase.from("saved_phrases").delete().eq("id", id).select("id");

  if (error) {
    // UUID フォーマット不正は Postgres 22P02（invalid_text_representation）
    if (error.code === "22P02") {
      return Response.json({ error: "id の形式が不正です" }, { status: 400 });
    }
    console.error("saved-phrases delete error:", error);
    return Response.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  // RLS により他ユーザー行は削除対象から外れる → 0 件 = 見つからない扱い
  if (!data || data.length === 0) {
    return Response.json({ error: "対象が見つかりません", code: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
