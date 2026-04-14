export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";

/**
 * `/api/voice-session` — 認証ユーザーの「分身の声」voice_id 永続化。
 *
 * mvp-scope.md 7.Q11 / 決定事項 5・6：
 *   - voice_features_vector カラムは設けない（特徴量ベクトル非保存）
 *   - 1 ユーザー 1 レコード（user_id に UNIQUE 制約 + upsert）
 *
 * ゲスト時はクライアントが localStorage に直接保存し、本 API は呼ばない。
 */

interface VoiceSessionRow {
  selected_voice_id: string;
  updated_at: string;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "認証が必要です" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "リクエスト本文の解析に失敗しました" }, { status: 400 });
    }

    const selectedVoiceId =
      typeof body === "object" && body !== null && "selectedVoiceId" in body
        ? (body as { selectedVoiceId: unknown }).selectedVoiceId
        : null;

    if (typeof selectedVoiceId !== "string" || selectedVoiceId.length === 0) {
      return Response.json({ error: "selectedVoiceId は必須です" }, { status: 400 });
    }

    // ElevenLabs voice_id は英数字主体（実際は base62 風）。極端に長い値・改行混入を弾く最低限のガード
    if (selectedVoiceId.length > 64 || /[\r\n\t]/.test(selectedVoiceId)) {
      return Response.json({ error: "selectedVoiceId の形式が不正です" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("voice_sessions")
      .upsert({ user_id: user.id, selected_voice_id: selectedVoiceId }, { onConflict: "user_id" })
      .select("selected_voice_id, updated_at")
      .single<VoiceSessionRow>();

    if (error || !data) {
      console.error("voice-session upsert error:", error);
      return Response.json({ error: "分身の声の保存に失敗しました" }, { status: 500 });
    }

    return Response.json({ voiceId: data.selected_voice_id, updatedAt: data.updated_at });
  } catch (err) {
    console.error("voice-session POST error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function GET(_req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("voice_sessions")
      .select("selected_voice_id, updated_at")
      .eq("user_id", user.id)
      .maybeSingle<VoiceSessionRow>();

    if (error) {
      console.error("voice-session GET error:", error);
      return Response.json({ error: "分身の声の取得に失敗しました" }, { status: 500 });
    }

    // 未作成は 404 ではなく 200 + null（クライアント側分岐を簡素化）
    if (!data) {
      return Response.json({ voiceId: null, updatedAt: null });
    }

    return Response.json({ voiceId: data.selected_voice_id, updatedAt: data.updated_at });
  } catch (err) {
    console.error("voice-session GET unexpected error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
