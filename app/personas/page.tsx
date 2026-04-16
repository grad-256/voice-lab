"use client";

// 静的プリレンダリングを無効化（Supabase クライアントはビルド時に初期化できないため）
export const dynamic = "force-dynamic";

import { type Persona, deletePersona, getPersonas } from "@/lib/personas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// ────────────────────────────────────────────────
// キャラ一覧画面
// ────────────────────────────────────────────────
export default function PersonasPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getPersonas();
      setPersonas(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    try {
      await deletePersona(id);
      setPersonas((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-8 flex-1 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/app"
            className="text-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1 transition-colors"
          >
            ← トップへ
          </Link>
          <h1 className="text-xl font-bold text-white">会話相手を選ぶ</h1>
          <p className="text-xs text-gray-400 mt-1">話しかけるキャラクターを選択してください</p>
        </div>
        <Link
          href="/personas/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + 新規作成
        </Link>
      </div>

      {/* エラー */}
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-900/60 border border-red-700 rounded-lg text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* ローディング */}
      {loading && <div className="text-center text-gray-500 py-16 text-sm">読み込み中...</div>}

      {/* キャラなし */}
      {!loading && personas.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🎭</p>
          <p className="text-gray-400 text-sm">まだキャラクターがいません</p>
          <Link
            href="/personas/new"
            className="mt-4 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            最初のキャラクターを作る
          </Link>
        </div>
      )}

      {/* キャラ一覧 */}
      <div className="space-y-3">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-700 transition-colors overflow-hidden"
          >
            {/* アバター */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {persona.name.charAt(0).toUpperCase()}
            </div>

            {/* 情報 */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{persona.name}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{persona.style_prompt}</p>
            </div>

            {/* ボタン */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => router.push(`/english?persona=${persona.id}`)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                話す
              </button>
              <button
                type="button"
                onClick={() => handleDelete(persona.id, persona.name)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 text-xs rounded-lg transition-colors"
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
