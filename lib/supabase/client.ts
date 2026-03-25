import { createBrowserClient } from "@supabase/ssr";

// ブラウザ（クライアントコンポーネント）用 Supabase クライアント
// ビルド時は env vars が未設定のためプレースホルダーを使用（実行時は実際の値が使われる）
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
  );
}
