"use client";

// 動的セグメント [id] + クライアント描画のため、Cloudflare Pages 向けに Edge Runtime を明示する必要がある
export const runtime = "edge";
export const dynamic = "force-dynamic";

import {
  AudioPlayer,
  BottomTab,
  BtnGhost,
  BtnPrimary,
  Cap,
  PageHeader,
  Rule,
} from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { formatMonoDateTime } from "@/lib/chapterDate";
import { ELEVENLABS_MULTILINGUAL } from "@/lib/models";
import { MONO_FAMILY } from "@/lib/typography";
import { useMountedRef } from "@/lib/useMountedRef";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

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
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const mountedRef = useMountedRef();

  useEffect(() => {
    params.then((p) => {
      if (mountedRef.current) setId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!id) return;
    // 未ログインの退避は AuthGate が担当。ここでは API を直接叩き、
    // 401 が返った場合のみ /app に退避する（AuthGate との競合時のフォールバック）。
    let aborted = false;
    const load = async () => {
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

  // 要約の TTS Blob を取得する。AudioPlayer が再生・進捗表示・停止を管理する。
  const fetchSummaryAudio = useCallback(async (): Promise<Blob | null> => {
    if (!entry) return null;
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entry.summary, modelId: ELEVENLABS_MULTILINGUAL }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch (err) {
      console.error("play error:", err);
      return null;
    }
  }, [entry]);

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
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24">
      <PageHeader
        left={
          <Link
            href="/diary/history"
            className="text-xs sm:text-sm uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            ← {t("back")}
          </Link>
        }
      />

      {errorMsg && (
        <div className="mt-10 text-xs sm:text-sm text-[var(--error)] text-center">{errorMsg}</div>
      )}

      {!entry && !errorMsg && (
        <div className="mt-14 text-center text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-subtle)]">
          {t("loading")}
        </div>
      )}

      {entry && (
        <article className="flex-1 flex flex-col">
          {/* 日時列：Chapter の mono ラベル。曜日・年月日・時刻を中点で繋ぐ */}
          <div
            className="mt-6 text-xs sm:text-sm uppercase tracking-[0.1em] text-[var(--fg-muted)]"
            style={{ fontFamily: MONO_FAMILY }}
          >
            {formatMonoDateTime(entry.created_at, locale)}
          </div>

          {/* 本文タイトル：Fraunces で大きく。折り返しは CSS 任せ（italic 強調はデータに頼れないため割愛）。 */}
          <h2
            className="mt-2 text-3xl sm:text-4xl tracking-tight text-[var(--fg)]"
            style={{ fontWeight: 400 }}
          >
            {entry.title}
          </h2>

          <Rule mv={18} />

          {/* 音声プレイヤー：丸ボタン + 波形 + 時間表示。summary を TTS で再生する。 */}
          <div className="mb-6">
            <AudioPlayer
              onFetchAudio={fetchSummaryAudio}
              playLabel={t("play")}
              pauseLabel={t("playing")}
            />
          </div>

          {/* 要約ブロック：左縦罫のある引用領域。Chapter 設計の書物感を作る */}
          <div style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 14 }}>
            <Cap mb={6}>{t("chapter.summaryLabel")}</Cap>
            <div
              className="text-sm sm:text-base md:text-lg leading-relaxed"
              style={{
                color: "var(--fg)",
                whiteSpace: "pre-wrap",
              }}
            >
              {entry.summary}
            </div>
          </div>

          {/* Transcript セクション：折りたたみ可。流れる活字で再構成。 */}
          {entry.transcript.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  className="text-xs sm:text-sm uppercase tracking-[0.4em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 p-0 cursor-pointer"
                >
                  {t("chapter.transcriptLabel")}{" "}
                  <span aria-hidden>{showTranscript ? "−" : "+"}</span>
                </button>
                <div
                  className="text-xs sm:text-sm uppercase tracking-[0.12em] text-[var(--fg-muted)]"
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
                        className="text-sm sm:text-base md:text-lg leading-loose"
                        style={{
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
                        <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-muted)] mb-1">
                          {t("chapter.quietVoice")}
                        </div>
                        <div
                          className="text-sm sm:text-base leading-normal"
                          style={{
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
            className="mt-10 pt-4 border-t border-[var(--border)] flex items-center gap-3 text-xs sm:text-sm uppercase tracking-[0.18em] text-[var(--fg-muted)]"
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

      {showDeleteConfirm && entry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn"
          onClick={() => { if (!deleting) setShowDeleteConfirm(false); }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !deleting) setShowDeleteConfirm(false);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm p-6 rounded-xl shadow-2xl bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <Cap mb={0}>{t("chapter.summaryLabel")}</Cap>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0 leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <h2 className="mb-3 text-2xl sm:text-3xl font-semibold leading-tight">
              {t("deleteConfirm.title")}
            </h2>
            <p
              className="text-xs sm:text-sm leading-relaxed mb-5"
              style={{ color: "var(--fg-muted)" }}
            >
              {t("deleteConfirm.desc")}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <BtnGhost full onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                  {t("deleteConfirm.cancel")}
                </BtnGhost>
              </div>
              <div className="flex-1">
                <BtnPrimary full onClick={handleDelete} disabled={deleting}>
                  {deleting ? t("deleting") : t("deleteConfirm.confirm")}
                </BtnPrimary>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomTab />
    </main>
  );
}
