"use client";

// 動的セグメント [id] + クライアント描画のため、Cloudflare Pages 向けに Edge Runtime を明示する必要がある
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ChevronDown, ChevronUp, Pause, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("diary.detail");
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
        router.push("/app");
        return;
      }
      try {
        const res = await fetch(`/api/diary/${id}`);
        if (aborted) return;
        if (res.status === 401) {
          router.push("/app");
          return;
        }
        if (res.status === 404) {
          setErrorMsg(t("notFound"));
          return;
        }
        if (!res.ok) {
          setErrorMsg(t("loadFailed"));
          return;
        }
        const data = (await res.json()) as { item: DiaryEntry };
        if (!aborted && mountedRef.current) setEntry(data.item);
      } catch (err) {
        console.error("diary detail load error:", err);
        if (!aborted && mountedRef.current) setErrorMsg(t("loadFailed"));
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [id, router, t]);

  const handlePlay = useCallback(async () => {
    if (!entry || playing) return;
    setPlaying(true);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 日記要約は長文・じっくり聞き返せる用途のため、表現力重視の eleven_v3 を使う
        body: JSON.stringify({ text: entry.summary, modelId: "eleven_v3" }),
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
          setErrorMsg(t("deleteFailed"));
          setDeleting(false);
        }
        return;
      }
      router.push("/diary/history");
    } catch (err) {
      console.error("diary delete error:", err);
      if (mountedRef.current) {
        setErrorMsg(t("deleteFailed"));
        setDeleting(false);
      }
    }
  }, [entry, deleting, router, t]);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      <header className="flex items-center justify-between mb-12 text-sm tracking-wide">
        <Link
          href="/diary/history"
          className="inline-flex items-center gap-1.5 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" aria-hidden="true" />
          {t("back")}
        </Link>
        <div className="w-12" />
      </header>

      {errorMsg && (
        <div className="mb-6 px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs text-center rounded-md">
          {errorMsg}
        </div>
      )}

      {!entry && !errorMsg && (
        <div className="text-center text-[var(--fg-subtle)] py-20 text-sm tracking-wide">
          {t("loading")}
        </div>
      )}

      {entry && (
        <article>
          {/* 日付 → タイトル → 区切り → 要約 → 付帯アクション → transcript → 削除 */}
          {/* Day One 流：日付は極小、タイトルは巨大に */}
          <time className="block font-mono-jp text-[11px] uppercase tracking-widest text-[var(--fg-subtle)]">
            {formatDate(entry.created_at)}
          </time>
          <h2 className="mt-4 text-2xl sm:text-3xl font-semibold text-[var(--fg)] leading-tight tracking-wide">
            {entry.title}
          </h2>
          <div className="mt-10 border-t border-[var(--border)]" />
          <p className="mt-10 text-[var(--fg)] leading-loose whitespace-pre-wrap">
            {entry.summary}
          </p>

          {/* 付帯アクション（音声再生）。色を抑えて本文を邪魔しない */}
          <div className="mt-10 flex items-center gap-3 text-sm tracking-wide">
            <button
              type="button"
              onClick={handlePlay}
              disabled={playing}
              className="inline-flex items-center gap-2 border border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--accent-strong)] hover:border-[var(--accent)] px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {playing ? (
                <Pause strokeWidth={1.5} className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Play strokeWidth={1.5} className="w-4 h-4" aria-hidden="true" />
              )}
              {playing ? t("playing") : t("play")}
            </button>
          </div>

          {/* transcript：折り畳みで補助情報に退避 */}
          {entry.transcript.length > 0 && (
            <div className="mt-16">
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
              >
                {showTranscript ? (
                  <ChevronUp strokeWidth={1.5} className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown strokeWidth={1.5} className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {showTranscript ? t("hideTranscript") : t("showTranscript")}
              </button>

              {showTranscript && (
                <div className="mt-8 space-y-6">
                  {entry.transcript.map((item, i) => (
                    <div key={`${item.role}-${i}-${item.text.slice(0, 20)}`}>
                      {item.role === "user" ? (
                        <p className="border-l-2 border-[var(--accent)] pl-4 py-1 text-sm text-[var(--fg)] leading-relaxed whitespace-pre-wrap">
                          {item.text}
                        </p>
                      ) : (
                        <p className="text-sm text-[var(--fg-muted)] leading-relaxed whitespace-pre-wrap">
                          {item.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 削除リンク：記事末の控えめな underline に退避 */}
          <div className="mt-20 pt-8 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--error)] underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 strokeWidth={1.5} className="w-3.5 h-3.5" aria-hidden="true" />
              {deleting ? t("deleting") : t("delete")}
            </button>
          </div>
        </article>
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirm && entry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-medium text-[var(--fg)] mb-2">
              {t("deleteConfirm.title")}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] mb-6 leading-relaxed">
              {t("deleteConfirm.desc")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-[var(--error)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-opacity"
              >
                {deleting ? t("deleting") : t("deleteConfirm.confirm")}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2.5 border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-50 text-sm rounded-md transition-colors"
              >
                {t("deleteConfirm.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
