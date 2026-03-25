import { createClient } from "@/lib/supabase/client";

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// ────────────────────────────────────────────────
// キャラの最新会話を取得、なければ新規作成
// ────────────────────────────────────────────────
export async function getOrCreateConversation(personaId: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  // 最新の会話を取得
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("persona_id", personaId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;

  // なければ新規作成
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ persona_id: personaId, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id;
}

// ────────────────────────────────────────────────
// 新しい会話セッションを作成（bye 後のリセット用）
// ────────────────────────────────────────────────
export async function createConversation(personaId: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("conversations")
    .insert({ persona_id: personaId, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

// ────────────────────────────────────────────────
// 会話のメッセージ一覧を取得
// ────────────────────────────────────────────────
export async function loadMessages(conversationId: string): Promise<ConversationMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConversationMessage[];
}

// ────────────────────────────────────────────────
// メッセージを保存
// ────────────────────────────────────────────────
export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}
