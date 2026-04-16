"use client";

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function HubPage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user);
    });
  }, []);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 flex flex-col">
      {/* ヘッダー */}
      <header className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          ← トップへ
        </Link>
        {isAuthed === false && (
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
            ログイン
          </Link>
        )}
        {isAuthed === true && (
          <Link
            href="/settings"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            設定
          </Link>
        )}
      </header>

      {/* タイトル */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
          何について話しますか？
        </h1>
        <p className="text-sm text-gray-400">選んで、話しはじめる。</p>
      </div>

      {/* 2 カード */}
      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        {/* 声の日記 */}
        <Link
          href="/diary"
          className="group relative block p-6 bg-gradient-to-br from-indigo-950/60 to-gray-900 border border-indigo-800/50 rounded-2xl hover:border-indigo-500 transition-all hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-200 transition-colors">
            声の日記
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            今日あったことを、AI と話しながら振り返る。 話した内容は、あとで読めるかたちで残ります。
          </p>
        </Link>

        {/* 英会話 */}
        <Link
          href="/english"
          className="group relative block p-6 bg-gradient-to-br from-emerald-950/60 to-gray-900 border border-emerald-800/50 rounded-2xl hover:border-emerald-500 transition-all hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-200 transition-colors">
            英会話
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            英語で話す練習。好きなキャラクターと、 自分のペースでリアルタイムにやりとり。
          </p>
        </Link>
      </div>

      {/* ログイン済ユーザー向け：過去の日記へ */}
      {isAuthed === true && (
        <div className="text-center mb-6">
          <Link
            href="/diary/history"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            過去の日記を見る →
          </Link>
        </div>
      )}

      {/* ステータス */}
      <div className="mt-auto text-center text-xs text-gray-500">
        {isAuthed === null && <span>　</span>}
        {isAuthed === false && (
          <span>
            ゲストとして体験中（{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 underline">
              ログイン
            </Link>{" "}
            で日記が保存できます）
          </span>
        )}
        {isAuthed === true && <span>ログイン中</span>}
      </div>
    </main>
  );
}
