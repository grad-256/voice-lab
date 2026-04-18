"use client";

export const dynamic = "force-dynamic";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setErrorMsg(
          data.error ?? "アカウントの削除に失敗しました。しばらく経ってから再度お試しください。"
        );
        setDeleting(false);
        return;
      }

      // 削除成功 → ログアウトしてログインページへ
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      setErrorMsg("アカウントの削除に失敗しました。しばらく経ってから再度お試しください。");
      setDeleting(false);
    }
  };

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app" className="text-gray-400 hover:text-white transition-colors text-sm">
          ← 戻る
        </Link>
        <h1 className="text-xl font-semibold text-white">設定</h1>
      </div>

      {/* 分身の声セクション */}
      <section className="border border-gray-800 rounded-xl p-6 bg-gray-900/30 mb-4">
        <h2 className="text-base font-semibold text-white mb-1">分身の声</h2>
        <p className="text-sm text-gray-400 mb-4">
          録音から似た声を選び直せます。選び直すと、場面再生の声が変わります。
        </p>
        <Link
          href="/settings/voice"
          className="inline-block px-4 py-2 bg-emerald-900/40 border border-emerald-800/60 text-emerald-200 text-sm rounded-lg hover:bg-emerald-900/60 transition-colors"
        >
          分身の声を作る・選び直す
        </Link>
      </section>

      {/* ログアウトセクション */}
      <section className="border border-gray-800 rounded-xl p-6 bg-gray-900/30 mb-4">
        <h2 className="text-base font-semibold text-white mb-1">ログアウト</h2>
        <p className="text-sm text-gray-400 mb-4">このデバイスからログアウトします。</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          ログアウト
        </button>
      </section>

      {/* アカウント削除セクション */}
      <section className="border border-red-900/40 rounded-xl p-6 bg-red-950/10">
        <h2 className="text-base font-semibold text-red-400 mb-1">アカウントを削除する</h2>
        <p className="text-sm text-gray-400 mb-4">
          アカウントを削除すると、登録情報がすべて削除されます。この操作は取り消せません。
        </p>

        {errorMsg && (
          <p className="text-sm text-red-400 mb-4 bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3">
            {errorMsg}
          </p>
        )}

        {!showConfirm ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors"
          >
            アカウントを削除する
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-white font-medium">
              本当に削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {deleting ? "削除中..." : "はい、削除します"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
