"use client";

// 動的セグメント [id] + クライアント描画のため、Cloudflare Pages 向けに Edge Runtime を明示する必要がある
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { BtnGhost, BtnPrimary, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useTranslations } from "next-intl";
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

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';
const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

// Chapter 詳細ヘッダ用の mono 日時。"TUE · 04·21·26 · 07:42" 形式にする。
function formatMonoDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  const weekday = d
    .toLocaleDateString(tag, { weekday: "short" })
    .replace(/曜日?/, "")
    .toUpperCase();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${weekday} · ${m}·${dd}·${yy} · ${h}:${min}`;
}

export default function DiaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const locale = useLocale();
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
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-8">
      <PageHeader
        left={
          <Link
            href="/diary/history"
            className="uppercase tracking-[0.32em] text-[9px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            ← {t("back")}
          </Link>
        }
      />

      {errorMsg && (
        <div className="mt-10 text-[11px] text-[var(--error)] text-center">{errorMsg}</div>
      )}

      {!entry && !errorMsg && (
        <div className="mt-14 text-center text-[10px] uppercase tracking-[0.3em] text-[var(--fg-subtle)]">
          {t("loading")}
        </div>
      )}

      {entry && (
        <article className="flex-1 flex flex-col">
          {/* 日時列：Chapter の mono ラベル。曜日・年月日・時刻を中点で繋ぐ */}
          <div
            className="mt-6 text-[10px] uppercase tracking-[0.1em] text-[var(--fg-muted)]"
            style={{ fontFamily: MONO_FAMILY }}
          >
            {formatMonoDateTime(entry.created_at, locale)}
          </div>

          {/* 本文タイトル：Fraunces で大きく。折り返しは CSS 任せ（italic 強調はデータに頼れないため割愛）。 */}
          <h2
            className="mt-2 text-[var(--fg)]"
            style={{
              fontFamily: SERIF_FAMILY,
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
            }}
          >
            {entry.title}
          </h2>

          <Rule mv={18} />

          {/* 要約ブロック：左縦罫のある引用領域。Chapter 設計の書物感を作る */}
          <div style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 14 }}>
            <Cap mb={6}>{t("chapter.summaryLabel")}</Cap>
            <div
              style={{
                fontFamily: SERIF_FAMILY,
                fontSize: 14,
                fontStyle: "italic",
                lineHeight: 1.6,
                letterSpacing: "-0.003em",
                color: "var(--fg)",
                whiteSpace: "pre-wrap",
              }}
            >
              {entry.summary}
            </div>
          </div>

          {/* 音声プレビュー再生（TTS）。activeCap 風の小ラベル + Ghost 調ボタン。 */}
          <div className="mt-5">
            <BtnGhost onClick={handlePlay} disabled={playing}>
              {playing ? t("playing") : t("play")}
            </BtnGhost>
          </div>

          {/* Transcript セクション：折りたたみ可。流れる活字で再構成。 */}
          {entry.transcript.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  className="uppercase text-[9px] tracking-[0.4em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 p-0 cursor-pointer"
                >
                  {t("chapter.transcriptLabel")}{" "}
                  <span aria-hidden>{showTranscript ? "−" : "+"}</span>
                </button>
                <div
                  className="text-[9px] uppercase tracking-[0.12em] text-[var(--fg-muted)]"
                  style={{ fontFamily: MONO_FAMILY }}
                >
                  {entry.language.toUpperCase()} · {entry.message_count.toString().padStart(2, "0")}{" "}
                  turns
                </div>
              </div>

              {showTranscript && (
                <div className="space-y-5">
                  {entry.transcript.map((item, i) =>
                    item.role === "user" ? (
                      <div
                        key={`${item.role}-${i}-${item.text.slice(0, 20)}`}
                        style={{
                          fontFamily: SERIF_FAMILY,
                          fontSize: 14,
                          lineHeight: 1.75,
                          letterSpacing: "-0.003em",
                          color: "var(--fg)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {item.text}
                      </div>
                    ) : (
                      <div
                        key={`${item.role}-${i}-${item.text.slice(0, 20)}`}
                        style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 12 }}
                      >
                        <div className="text-[9px] uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-1">
                          {t("chapter.quietVoice")}
                        </div>
                        <div
                          style={{
                            fontFamily: SERIF_FAMILY,
                            fontStyle: "italic",
                            fontSize: 13,
                            lineHeight: 1.55,
                            color: "var(--fg)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.text}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* 削除リンク：mono の小さな操作列。誤タップしにくい末尾に配置 */}
          <div
            className="mt-10 pt-4 border-t border-[var(--border)] flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)]"
            style={{ fontFamily: MONO_FAMILY }}
          >
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="bg-transparent border-0 p-0 cursor-pointer text-[var(--fg-muted)] hover:text-[var(--error)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? t("deleting") : t("delete")}
            </button>
          </div>
        </article>
      )}

      {/* 削除確認モーダル（Chapter 系の 0.5px 罫 + Fraunces） */}
      {showDeleteConfirm && entry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn">
          <div
            className="w-full max-w-sm p-6 bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--fg)" }}
          >
            <Cap mb={6}>{t("chapter.summaryLabel")}</Cap>
            <h2
              className="mb-3"
              style={{
                fontFamily: SERIF_FAMILY,
                fontSize: 20,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
                fontStyle: "italic",
              }}
            >
              {t("deleteConfirm.title")}
            </h2>
            <p className="text-[12px] leading-relaxed mb-5" style={{ color: "var(--fg-muted)" }}>
              {t("deleteConfirm.desc")}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <BtnPrimary full onClick={handleDelete} disabled={deleting}>
                  {deleting ? t("deleting") : t("deleteConfirm.confirm")}
                </BtnPrimary>
              </div>
              <BtnGhost onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                {t("deleteConfirm.cancel")}
              </BtnGhost>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
