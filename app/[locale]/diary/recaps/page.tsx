"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { BottomTab, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

// APIレスポンス型
type WeeklyRecap = {
  id: string;
  week_start: string; // "2026-04-21" 形式
  summary: string;
  created_at: string;
};

// 週の期間を "Apr 21 – Apr 27"（英語）または "4/21 – 4/27"（日本語）形式でフォーマットする
// date-only 文字列（"2026-04-21"）は UTC 00:00 として解釈されるため
// getUTC* 系で統一し、ローカルタイムとの混在によるズレを防ぐ。
function formatWeekRange(weekStart: string, locale: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);

  if (locale === "ja") {
    const startStr = `${start.getUTCMonth() + 1}/${start.getUTCDate()}`;
    const endStr = `${end.getUTCMonth() + 1}/${end.getUTCDate()}`;
    return `${startStr} – ${endStr}`;
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const startStr = `${months[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endStr = `${months[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${startStr} – ${endStr}`;
}

export default function DiaryRecapsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("diary.recaps");

  const [recaps, setRecaps] = useState<WeeklyRecap[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recapPlaying, setRecapPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  // 振り返り一覧を取得する（aborted パターンでクリーンアップ）
  useEffect(() => {
    let aborted = false;
    const load = async () => {
      const res = await fetch("/api/weekly-recap?history=true");
      if (aborted) return;
      if (res.status === 401) {
        router.push("/app");
        return;
      }
      if (!res.ok) {
        setErrorMsg(t("loadFailed"));
        setRecaps([]);
        return;
      }
      const data = (await res.json()) as { recaps?: WeeklyRecap[] };
      if (!aborted) setRecaps(data.recaps ?? []);
    };
    load().catch(() => {
      if (!aborted) {
        setErrorMsg(t("loadFailed"));
        setRecaps([]);
      }
    });
    return () => {
      aborted = true;
    };
  }, [router, t]);

  // 音声再生ハンドラ
  const playRecap = async (text: string) => {
    if (recapPlaying) return;
    setRecapPlaying(true);
    setPlayError(null);
    let ctx: AudioContext | null = null;
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, locale, modelId: "eleven_v3", speed: 1.0 }),
      });
      if (!res.ok) throw new Error("speak failed");
      const buffer = await res.arrayBuffer();
      ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(buffer);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.onended = () => {
        setRecapPlaying(false);
        ctx?.close();
      };
      src.start();
    } catch {
      setRecapPlaying(false);
      setPlayError(t("playError"));
      ctx?.close();
    }
  };

  // アイテムのトグル：同じものをクリックすると閉じる
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    // 折りたたむときは再生エラーをリセット
    setPlayError(null);
  };

  const total = recaps?.length ?? 0;

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
        right="Recaps"
      />

      {/* 章題 */}
      <div className="mt-6">
        <Cap mb={8}>{t("chapter.archiveLabel")}</Cap>
        <div
          className="text-3xl sm:text-4xl md:text-5xl tracking-tight"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
        >
          {t("chapter.titleLead")} <span className="italic">{t("chapter.titleAccent")}</span>
          {t("chapter.titleTail")}
        </div>
        <div
          className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[6px] tracking-wider"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {total} {t("chapter.countSuffix")}
        </div>
      </div>

      <Rule mv={20} />

      {/* 読み込み中 */}
      {recaps === null && !errorMsg && (
        <div
          className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-subtle)] py-14 text-center"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {t("loading")}
        </div>
      )}

      {/* エラー */}
      {errorMsg && (
        <div
          className="mb-4 text-xs sm:text-sm text-[var(--error)] text-center"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {errorMsg}
        </div>
      )}

      {/* 空状態 */}
      {recaps !== null && recaps.length === 0 && !errorMsg && (
        <div className="flex-1 flex flex-col items-start justify-start pt-8 gap-6">
          <p className="text-xs text-[var(--fg-subtle)]" style={{ fontFamily: MONO_FAMILY }}>
            {t("empty")}
          </p>
        </div>
      )}

      {/* 音声再生エラー */}
      {playError && (
        <p
          className="mb-3 text-xs sm:text-sm text-[var(--error)]"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {playError}
        </p>
      )}

      {/* 振り返り一覧 */}
      {recaps && recaps.length > 0 && (
        <ul className="flex-1 overflow-y-auto -mx-1">
          {recaps.map((item) => {
            const isExpanded = expandedId === item.id;
            const weekRange = formatWeekRange(item.week_start, locale);
            // 折りたたみ時は先頭40文字のプレビュー
            const preview =
              item.summary.length > 40 ? `${item.summary.slice(0, 40)}…` : item.summary;

            return (
              <li key={item.id}>
                {/* biome-ignore lint/a11y/useSemanticElements: <button> の入れ子（li > button > button）によるHTML違反を避けるため div+role="button" で代替。キーボード操作は onKeyDown で担保。 */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(item.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" || e.key === " " ? toggleExpand(item.id) : undefined
                  }
                  className="w-full text-left grid items-start gap-3 px-1 py-[14px] border-b border-[var(--border)] hover:bg-[var(--chip)] transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: "1fr auto" }}
                >
                  {/* 左列：週の期間 + サマリー */}
                  <div className="min-w-0">
                    {/* 週の期間ラベル */}
                    <div
                      className="text-xs uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-[6px]"
                      style={{ fontFamily: MONO_FAMILY }}
                    >
                      {weekRange}
                    </div>

                    {/* 折りたたみ：先頭40文字 / 展開：全文 */}
                    <div
                      className="text-sm sm:text-base leading-relaxed text-[var(--fg)]"
                      style={{ fontFamily: SERIF_FAMILY }}
                    >
                      {isExpanded ? item.summary : preview}
                    </div>

                    {/* 展開時：音声で聞くボタン */}
                    {isExpanded && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playRecap(item.summary);
                          }}
                          disabled={recapPlaying}
                          className="text-xs sm:text-sm uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors disabled:opacity-60"
                          style={{ fontFamily: MONO_FAMILY }}
                        >
                          {recapPlaying ? t("playing") : `${t("play")} →`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 右列：展開インジケーター */}
                  <div
                    className="text-xs sm:text-sm text-[var(--fg-muted)] pt-[2px] transition-transform duration-200"
                    style={{
                      fontFamily: MONO_FAMILY,
                      transform: isExpanded ? "rotate(90deg)" : "none",
                    }}
                  >
                    →
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <BottomTab />
    </main>
  );
}
