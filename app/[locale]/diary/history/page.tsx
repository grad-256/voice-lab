"use client";

export const dynamic = "force-dynamic";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type DiaryItem = {
  id: string;
  title: string;
  summary: string;
  language: string;
  message_count: number;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd} ${h}:${min}`;
}

export default function DiaryHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<DiaryItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      try {
        const res = await fetch("/api/diary");
        if (aborted) return;
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setErrorMsg("読み込みに失敗しました");
          setItems([]);
          return;
        }
        const data = (await res.json()) as { items?: DiaryItem[] };
        if (!aborted) setItems(data.items ?? []);
      } catch (err) {
        console.error("diary history load error:", err);
        if (!aborted) {
          setErrorMsg("読み込みに失敗しました");
          setItems([]);
        }
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [router]);

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/app" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← 戻る
        </Link>
        <h1 className="text-base text-white font-medium">日記の履歴</h1>
        <Link
          href="/diary"
          className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          新しく話す
        </Link>
      </header>

      {errorMsg && (
        <div className="mb-4 px-3 py-2 bg-red-900/60 border border-red-700 rounded-lg text-red-200 text-xs text-center">
          {errorMsg}
        </div>
      )}

      {items === null && !errorMsg && (
        <div className="text-center text-gray-500 py-16 text-sm">読み込み中…</div>
      )}

      {items !== null && items.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm mb-4">まだ日記がありません</p>
          <Link
            href="/diary"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            最初の日記を話す
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/diary/history/${item.id}`}
              className="block p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-500 transition-colors"
            >
              <div className="text-xs text-gray-500 mb-1">{formatDate(item.created_at)}</div>
              <h2 className="text-sm text-white font-medium mb-2 truncate">{item.title}</h2>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 whitespace-pre-wrap">
                {item.summary}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
