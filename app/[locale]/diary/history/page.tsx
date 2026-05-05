"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { BottomTab, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { formatMonoDate } from "@/lib/chapterDate";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type DiaryItem = {
  id: string;
  title: string;
  summary: string;
  language: string;
  message_count: number;
  created_at: string;
};

// 週間要約の型（バックエンドAPIレスポンスに合わせる）
type WeeklyRecap = { id: string; summary: string; created_at: string } | null;

export default function DiaryHistoryPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("diary.history");
  const [items, setItems] = useState<DiaryItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 週間要約の状態
  const [recap, setRecap] = useState<WeeklyRecap>(null);
  const [recapLoading, setRecapLoading] = useState(true);
  const [recapGenerating, setRecapGenerating] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);

  useEffect(() => {
    // 未ログインの退避は AuthGate が担当。ここでは API を直接叩き、
    // 401 が返った場合のみ /app に退避する（レア：AuthGate との競合時のフォールバック）。
    let aborted = false;
    const load = async () => {
      try {
        const res = await fetch("/api/diary");
        if (aborted) return;
        if (res.status === 401) {
          router.push("/app");
          return;
        }
        if (!res.ok) {
          setErrorMsg(t("loadFailed"));
          setItems([]);
          return;
        }
        const data = (await res.json()) as { items?: DiaryItem[] };
        if (!aborted) setItems(data.items ?? []);
      } catch (err) {
        console.error("diary history load error:", err);
        if (!aborted) {
          setErrorMsg(t("loadFailed"));
          setItems([]);
        }
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [router, t]);

  // 週間要約を取得する（日記一覧とは独立した useEffect）
  useEffect(() => {
    let aborted = false;
    fetch("/api/weekly-recap")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { recap: WeeklyRecap } | null) => {
        if (!aborted) setRecap(data?.recap ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!aborted) setRecapLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, []);

  // 週間要約を生成するハンドラ
  const generateRecap = async () => {
    setRecapGenerating(true);
    setRecapError(null);
    try {
      const res = await fetch("/api/weekly-recap", { method: "POST" });
      const data = (await res.json()) as { recap?: WeeklyRecap; error?: string };
      if (data.recap) {
        setRecap(data.recap);
      } else {
        setRecapError(t("recap.generateError"));
      }
    } catch {
      setRecapError(t("recap.generateError"));
    } finally {
      setRecapGenerating(false);
    }
  };

  const total = items?.length ?? 0;
  const pageNo = String(total).padStart(3, "0");

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24">
      <PageHeader />

      {/* 章題：静けさの記録。活字で「余白」を italic に抜く。 */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <Cap mb={8}>{t("chapter.archiveLabel")}</Cap>
          <div className="flex items-baseline gap-4">
            <Link
              href="/diary/recaps"
              className="text-xs sm:text-sm uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              Recaps →
            </Link>
            {/* Insights への動線（フリーアルファリリース時点では未準備のためコメントアウト）
                準備ができたらコメントを外してリリースする。
            <Link
              href="/diary/insights"
              className="text-xs sm:text-sm uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              Insights →
            </Link>
            */}
          </div>
        </div>
        <div
          className="text-3xl sm:text-4xl md:text-5xl tracking-tight"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
        >
          {t("chapter.titleLead")} <span>{t("chapter.titleAccent")}</span>
          <br />
          {t("chapter.titleTail")}
        </div>
        <div
          className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[6px] tracking-wider"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {pageNo} · {t("chapter.countSuffix")}
        </div>
      </div>

      <Rule mv={20} />

      {/* 週間要約セクション（Quiet プランの機能） */}
      {!recapLoading && (
        <>
          <Cap mb={8}>{t("recap.cap")}</Cap>

          {recapError && (
            <p
              className="mb-2 text-xs sm:text-sm text-[var(--error)]"
              style={{ fontFamily: MONO_FAMILY }}
            >
              {recapError}
            </p>
          )}

          {/* 状態A: レコードなし */}
          {recap === null && !recapGenerating && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-xs text-[var(--fg-subtle)]" style={{ fontFamily: MONO_FAMILY }}>
                {t("recap.empty")}
              </p>
              <button
                type="button"
                onClick={generateRecap}
                className="text-xs uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              >
                {t("recap.generate")} →
              </button>
            </div>
          )}

          {/* 状態B: 生成中（POST中） */}
          {recapGenerating && (
            <p className="text-xs text-[var(--fg-subtle)]" style={{ fontFamily: MONO_FAMILY }}>
              {t("recap.generating")}
            </p>
          )}

          {/* 状態C: レコードあり（内容は Recaps ページでのみ表示） */}
          {recap !== null && !recapGenerating && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-xs text-[var(--fg-subtle)]" style={{ fontFamily: MONO_FAMILY }}>
                {t("recap.done")}
              </p>
              <Link
                href="/diary/recaps"
                className="text-xs uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              >
                {t("recap.viewRecaps")} →
              </Link>
            </div>
          )}

          <Rule mv={16} />
        </>
      )}

      {errorMsg && (
        <div className="mb-4 text-xs sm:text-sm text-[var(--error)] text-center">{errorMsg}</div>
      )}

      {/* 読み込み中：薄く Loading 表記 */}
      {items === null && !errorMsg && (
        <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-subtle)] py-14 text-center">
          {t("loading")}
        </div>
      )}

      {/* 空状態：3 行の静かな活字で不在を告げる。Begin で /diary へ */}
      {items !== null && items.length === 0 && (
        <div className="flex-1 flex flex-col items-start justify-start pt-8 gap-6">
          <div className="text-3xl sm:text-4xl tracking-tight" style={{ fontWeight: 400 }}>
            {t("chapter.emptyLead")} <span>{t("chapter.emptyAccent")}</span>
            <br />
            {t("chapter.emptyTail")}
          </div>
          <Link
            href="/diary"
            className="text-xs sm:text-sm uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            {t("emptyCta")} →
          </Link>
        </div>
      )}

      {/* 日記一覧：日付箱 | タイトル列 | 矢印、の 3 カラム行。0.5px の細罫で区切る */}
      {items && items.length > 0 && (
        <>
          <div
            className="mb-3 text-xs uppercase tracking-[0.22em] text-[var(--fg-subtle)]"
            style={{ fontFamily: MONO_FAMILY }}
          >
            {t("freePlanNote")}
          </div>
          <ul className="flex-1 overflow-y-auto -mx-1">
            {items.map((item) => {
              const d = formatMonoDate(item.created_at, locale);
              return (
                <li key={item.id}>
                  <Link
                    href={`/diary/history/${item.id}`}
                    className="grid items-center gap-3 px-1 py-[14px] border-b border-[var(--border)] hover:bg-[var(--chip)] transition-colors"
                    style={{ gridTemplateColumns: "52px 1fr auto" }}
                  >
                    <div>
                      <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-[var(--fg-muted)]">
                        {d.day}
                      </div>
                      <div
                        className="text-2xl sm:text-3xl md:text-4xl tracking-tight"
                        style={{ fontFamily: SERIF_FAMILY }}
                      >
                        {d.dayNum}
                      </div>
                      <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-[var(--fg-muted)] mt-[2px]">
                        {d.month}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-base sm:text-lg leading-tight tracking-tight line-clamp-2 text-[var(--fg)]">
                        {item.title}
                      </div>
                      <div className="flex gap-[10px] mt-1 text-xs sm:text-sm uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                        <span>{item.language.toUpperCase()}</span>
                        <span aria-hidden>·</span>
                        <span>{item.message_count.toString().padStart(2, "0")} turns</span>
                      </div>
                    </div>
                    <div
                      style={{ fontFamily: MONO_FAMILY }}
                      className="text-xs sm:text-sm text-[var(--fg-muted)]"
                    >
                      →
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <BottomTab />
    </main>
  );
}
