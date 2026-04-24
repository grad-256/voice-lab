import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 管理クライアント（service role key 使用）
 * RLS をバイパスしてテーブルにアクセスするために使う。
 * サーバーサイドのみで使用すること。クライアントに露出させない。
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
}
