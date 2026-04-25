export const runtime = "edge";

import { createClient } from "@/lib/supabase/server";

export async function DELETE(_req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "認証が必要です" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    };

    // ユーザーを削除（Supabase Admin API 経由。RLS 対象外のため service role key を使用）
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: adminHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supabase Admin delete error:", errorText);
      return Response.json(
        { error: "アカウントの削除に失敗しました。しばらく経ってから再度お試しください。" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("account delete error:", err);
    return Response.json(
      { error: "アカウントの削除に失敗しました。しばらく経ってから再度お試しください。" },
      { status: 500 }
    );
  }
}
