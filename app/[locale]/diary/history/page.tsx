"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { BottomTab, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
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

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';
const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

// 「4·21·26」形式の mono 表示。Chapter の archive 行で「日付箱」の下に添える。
function formatMonoDate(
  iso: string,
  locale: string
): {
  day: string;
  dayNum: string;
  month: string;
} {
  const d = new Date(iso);
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  const weekday = d
    .toLocaleDateString(tag, { weekday: "short" })
    .replace(/曜日?/, "")
    .toUpperCase();
  const month =
    locale === "ja"
      ? `${d.getMonth() + 1}月`.toUpperCase()
      : d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return {
    day: weekday,
    dayNum: String(d.getDate()).padStart(2, "0"),
    month,
  };
}

export default function DiaryHistoryPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("diary.history");
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
        router.push("/app");
        return;
      }
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

  const total = items?.length ?? 0;
  const pageNo = String(total).padStart(3, "0");

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-3">
      <PageHeader right={`No. ${pageNo}`} />

      {/* 章題：静けさの記録。活字で「余白」を italic に抜く。 */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <Cap mb={8}>{t("chapter.archiveLabel")}</Cap>
          <Link
            href="/diary/insights"
            className="uppercase text-[9px] tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            Insights →
          </Link>
        </div>
        <div
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
          }}
        >
          {t("chapter.titleLead")}{" "}
          <span style={{ fontStyle: "italic" }}>{t("chapter.titleItalic")}</span>
          <br />
          {t("chapter.titleTail")}
        </div>
        <div
          className="text-[11px] text-[var(--fg-muted)] mt-[6px]"
          style={{ fontFamily: MONO_FAMILY, letterSpacing: "0.06em" }}
        >
          {pageNo} · {t("chapter.countSuffix")}
        </div>
      </div>

      <Rule mv={20} />

      {errorMsg && (
        <div className="mb-4 text-[11px] text-[var(--error)] text-center">{errorMsg}</div>
      )}

      {/* 読み込み中：薄く Loading 表記 */}
      {items === null && !errorMsg && (
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--fg-subtle)] py-14 text-center">
          {t("loading")}
        </div>
      )}

      {/* 空状態：3 行の静かな活字で不在を告げる。Begin で /diary へ */}
      {items !== null && items.length === 0 && (
        <div className="flex-1 flex flex-col items-start justify-start pt-8 gap-6">
          <div
            style={{
              fontFamily: SERIF_FAMILY,
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {t("chapter.emptyLead")}{" "}
            <span style={{ fontStyle: "italic" }}>{t("chapter.emptyItalic")}</span>
            <br />
            {t("chapter.emptyTail")}
          </div>
          <Link
            href="/diary"
            className="uppercase text-[9px] tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            {t("emptyCta")} →
          </Link>
        </div>
      )}

      {/* 日記一覧：日付箱 | タイトル列 | 矢印、の 3 カラム行。0.5px の細罫で区切る */}
      {items && items.length > 0 && (
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
                    <div className="text-[8px] uppercase tracking-[0.2em] text-[var(--fg-muted)]">
                      {d.day}
                    </div>
                    <div
                      style={{
                        fontFamily: SERIF_FAMILY,
                        fontSize: 24,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}
                    >
                      {d.dayNum}
                    </div>
                    <div className="text-[8px] uppercase tracking-[0.2em] text-[var(--fg-muted)] mt-[2px]">
                      {d.month}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div
                      style={{
                        fontFamily: SERIF_FAMILY,
                        fontSize: 15,
                        letterSpacing: "-0.005em",
                        lineHeight: 1.25,
                      }}
                      className="line-clamp-2 text-[var(--fg)]"
                    >
                      {item.title}
                    </div>
                    <div className="flex gap-[10px] mt-1 text-[9.5px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                      <span>{item.language.toUpperCase()}</span>
                      <span aria-hidden>·</span>
                      <span>{item.message_count.toString().padStart(2, "0")} turns</span>
                    </div>
                  </div>
                  <div
                    style={{ fontFamily: MONO_FAMILY }}
                    className="text-[11px] text-[var(--fg-muted)]"
                  >
                    →
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto pt-3">
        <BottomTab />
      </div>
    </main>
  );
}
