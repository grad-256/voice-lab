import { createClient } from "@/lib/supabase/client";

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
export type Persona = {
  id: string;
  user_id: string;
  name: string;
  style_prompt: string;
  voice_id: string;
  created_at: string;
};

// ElevenLabs Starter プランで使える標準ボイス一覧
export const VOICE_OPTIONS = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella（女性・落ち着き）" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel（女性・フレンドリー）" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi（女性・活発）" },
  { id: "pMsXgVXv3BLzUgSXRplE", label: "Serena（女性・穏やか）" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni（男性・落ち着き）" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold（男性・力強い）" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam（男性・ナレーター）" },
] as const;

// ────────────────────────────────────────────────
// キャラ一覧を取得
// ────────────────────────────────────────────────
export async function getPersonas(): Promise<Persona[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ────────────────────────────────────────────────
// キャラを作成
// ────────────────────────────────────────────────
export async function createPersona(input: {
  name: string;
  style_prompt: string;
  voice_id: string;
}): Promise<Persona> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("personas")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ────────────────────────────────────────────────
// キャラを削除
// ────────────────────────────────────────────────
export async function deletePersona(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("personas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
