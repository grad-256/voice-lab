"use client";

// 動的セグメント [id] + クライアント描画のため、Cloudflare Pages 向けに Edge Runtime を明示する必要がある
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";

type TranscriptItem = { role: "user" | "assistant"; text: string };

type DiaryEntry = {
  id: string;
  title: string;
  summary: string;
  transcript: TranscriptItem[];
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

export default function DiaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    params.then((p) => {
      if (mountedRef.current) setId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!id) return;
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
        const res = await fetch(`/api/diary/${id}`);
        if (aborted) return;
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setErrorMsg("見つかりませんでした");
          return;
        }
        if (!res.ok) {
          setErrorMsg("読み込みに失敗しました");
          return;
        }
        const data = (await res.json()) as { item: DiaryEntry };
        if (!aborted && mountedRef.current) setEntry(data.item);
      } catch (err) {
        console.error("diary detail load error:", err);
        if (!aborted && mountedRef.current) setErrorMsg("読み込みに失敗しました");
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [id, router]);

  const handlePlay = useCallback(async () => {
    if (!entry || playing) return;
    setPlaying(true);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entry.summary }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setPlaying(false);
        return;
      }
      const blob = await res.blob();
      if (!mountedRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
    } catch (err) {
      console.error("play error:", err);
    } finally {
      if (mountedRef.current) setPlaying(false);
    }
  }, [entry, playing]);

  const handleDelete = useCallback(async () => {
    if (!entry || deleting) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/diary?id=${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        if (mountedRef.current) {
          setErrorMsg("削除に失敗しました");
          setDeleting(false);
        }
        return;
      }
      router.push("/diary/history");
    } catch (err) {
      console.error("diary delete error:", err);
      if (mountedRef.current) {
        setErrorMsg("削除に失敗しました");
        setDeleting(false);
      }
    }
  }, [entry, deleting, router]);

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <Link
          href="/diary/history"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← 履歴
        </Link>
        <h1 className="text-sm text-gray-400">日記</h1>
        <div className="w-12" />
      </header>

      {errorMsg && (
        <div className="mb-4 px-3 py-2 bg-red-900/60 border border-red-700 rounded-lg text-red-200 text-xs text-center">
          {errorMsg}
        </div>
      )}

      {!entry && !errorMsg && (
        <div className="text-center text-gray-500 py-16 text-sm">読み込み中…</div>
      )}

      {entry && (
        <>
          <div className="text-xs text-gray-500 mb-2">{formatDate(entry.created_at)}</div>
          <h2 className="text-xl font-semibold text-white mb-4 leading-relaxed">{entry.title}</h2>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap mb-6">
            {entry.summary}
          </p>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={handlePlay}
              disabled={playing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              {playing ? "再生中…" : "もう一度聞く"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="px-4 py-2 bg-gray-800 hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:text-red-200 text-sm rounded-lg transition-colors"
            >
              {deleting ? "削除中…" : "削除"}
            </button>
          </div>

          {entry.transcript.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-xs text-gray-400 hover:text-white mb-3 transition-colors"
              >
                {showTranscript ? "▼ 元の会話を隠す" : "▶ 元の会話を読む"}
              </button>

              {showTranscript && (
                <div className="space-y-2 pb-10">
                  {entry.transcript.map((t, i) => (
                    <div
                      key={`${t.role}-${i}-${t.text.slice(0, 20)}`}
                      className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                          t.role === "user"
                            ? "bg-indigo-700/60 text-white"
                            : "bg-gray-800 text-gray-200"
                        }`}
                      >
                        {t.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirm && entry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-white mb-2">この日記を削除しますか？</h2>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              削除すると元には戻せません。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleting ? "削除中…" : "削除する"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
              >
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
