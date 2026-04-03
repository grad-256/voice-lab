export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  messageId: string;
  rating: "positive" | "negative";
};

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

    const body = (await req.json()) as RequestBody;
    const { messageId, rating } = body;

    if (!messageId || !rating) {
      return Response.json({ error: "messageId と rating は必須です" }, { status: 400 });
    }

    if (rating !== "positive" && rating !== "negative") {
      return Response.json(
        { error: "rating は 'positive' または 'negative' のみ有効です" },
        { status: 400 }
      );
    }

    // upsert: 同じ message_id + user_id の組み合わせがあれば更新
    const { data, error } = await supabase
      .from("message_feedback")
      .upsert(
        {
          message_id: messageId,
          user_id: user.id,
          rating,
        },
        { onConflict: "message_id,user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("feedback upsert error:", error);
      return Response.json({ error: "フィードバックの保存に失敗しました" }, { status: 500 });
    }

    return Response.json({ success: true, feedback: data });
  } catch (err) {
    console.error("feedback error:", err);
    return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
