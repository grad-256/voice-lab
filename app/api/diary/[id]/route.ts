export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";

// 個別の日記エントリ取得。RLS で本人のレコードだけヒットする。

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "id は必須です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .select("id, title, summary, transcript, language, message_count, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") {
      return Response.json({ error: "id の形式が不正です" }, { status: 400 });
    }
    console.error("diary get error:", error);
    return Response.json({ error: "取得に失敗しました" }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "対象が見つかりません", code: "NOT_FOUND" }, { status: 404 });
  }
  return Response.json({ item: data });
}
