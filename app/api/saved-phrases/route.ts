export const runtime = "edge";

import { normalizeEnglish } from "@/lib/suggest";
import { createClient } from "@/lib/supabase/server";

/**
 * `/api/saved-phrases` — 「これ言えなかった」モーダルや独立画面から保存されるフレーズ。
 *
 * mvp-scope.md 3.7 節 / Sprint 3：
 *   - 認証必須（ゲストは呼ばない。クライアント側でログイン導線を出す）
 *   - source は 'preset' | 'user' | 'suggest'
 *   - en_text_normalized は `lib/suggest.normalizeEnglish` で生成
 *   - RLS：auth.uid() = user_id
 */

type Source = "preset" | "user" | "suggest";
const VALID_SOURCES: Source[] = ["preset", "user", "suggest"];

const MAX_EN_LENGTH = 500;
const MAX_JA_LENGTH = 500;
const MAX_PHRASE_ID_REF_LENGTH = 64;

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
