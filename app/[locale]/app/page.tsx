"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useAuth } from "@/app/components/auth/AuthContext";
import { BottomTab, BtnPrimary, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import type { User } from "@supabase/supabase-js";
import { User as UserIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';
const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

type RawDiaryItem = {
  id: string;
  created_at: string;
};

type DayCell = {
  dayLabel: string;
  dayNum: string;
  isToday: boolean;
  hasEntry: boolean;
};

type GreetingKey = "greetingMorning" | "greetingAfternoon" | "greetingEvening" | "greetingNight";

// 時間帯でヒトの気配を変える。朝の静けさ・夜の沈静を言い換えているだけで分岐は UI 装飾。
function getGreetingKey(hour: number): GreetingKey {
  if (hour >= 4 && hour < 11) return "greetingMorning";
  if (hour >= 11 && hour < 17) return "greetingAfternoon";
  if (hour >= 17 && hour < 22) return "greetingEvening";
  return "greetingNight";
}

// 日付の "Cap" 表示。locale ごとに読める形に整形する。
// JA: "火曜日 · 4月21日" / EN: "Tuesday · Apr 21"
function formatDateCap(date: Date, locale: string): string {
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  const weekday = date.toLocaleDateString(tag, { weekday: "long" });
  const md =
    locale === "ja"
      ? `${date.getMonth() + 1}月${date.getDate()}日`
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday} · ${md}`;
}

// 直近 7 日ぶんのセルを「今日 → 6 日前」の順で生成。
// 同日キーは `YYYY-M-D`（0 埋めしない）で比較、ローカルタイム基準。
function buildLast7Days(entries: RawDiaryItem[], locale: string): DayCell[] {
  const entryDates = new Set(
    entries.map((e) => {
      const d = new Date(e.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  const now = new Date();
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    cells.push({
      dayLabel: d.toLocaleDateString(tag, { weekday: "short" }),
      dayNum: String(d.getDate()).padStart(2, "0"),
      isToday: i === 0,
      hasEntry: entryDates.has(key),
    });
  }
  return cells;
}

function extractName(user: User | null, fallback: string): string {
  if (!user) return fallback;
  const meta = user.user_metadata as { full_name?: string } | undefined;
  if (meta?.full_name) return meta.full_name;
  if (user.email) return user.email.split("@")[0];
  return fallback;
}

export default function HubPage() {
  const t = useTranslations("hub");
  const locale = useLocale();
  const { user, loading, openDialog } = useAuth();
  const isAuthed = loading ? null : user !== null;

  const [entries, setEntries] = useState<RawDiaryItem[]>([]);

  // ログイン済みのとき、直近 7 日の streak 表示用にエントリ一覧を取得する。
  // /api/diary?limit=100 で十分（7 日分の判定なら 1 日 10 件でも間に合う）。
  useEffect(() => {
    if (!isAuthed) {
      setEntries([]);
      return;
    }
    let aborted = false;
    fetch("/api/diary?limit=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: RawDiaryItem[] } | null) => {
        if (aborted || !data?.items) return;
        setEntries(data.items);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [isAuthed]);

  const now = new Date();
  const greetingKey = getGreetingKey(now.getHours());
  const name = extractName(user, t("chapter.noName"));
  const dateCap = formatDateCap(now, locale);
  const days = buildLast7Days(entries, locale);
  const streakCount = days.filter((d) => d.hasEntry).length;

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-3">
      {/* 章立てヘッダ：左に MyVoiceLab、右にログイン状態 */}
      <PageHeader
        right={
          isAuthed === null ? (
            <span aria-hidden className="inline-block w-9 h-5" />
          ) : isAuthed === false ? (
            <button
              type="button"
              onClick={() => openDialog("login")}
              className="uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer text-[9px] p-0"
            >
              {t("login")}
            </button>
          ) : (
            <Link
              href="/me"
              aria-label={t("myPage")}
              className="relative inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--fg-muted)] transition-colors"
            >
              <UserIcon size={14} strokeWidth={1.5} aria-hidden />
              <span
                aria-hidden
                className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-[var(--bg)]"
              />
            </Link>
          )
        }
      />

      {/* 挨拶：時刻 + 相手の名前。Fraunces italic で紙に近い気配を作る。
          グラデは globals.css の --grad-title-* を再利用（Light/Dark 自動追従）。 */}
      <div className="mt-6">
        <Cap mb={8}>{dateCap}</Cap>
        <div
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: 34,
            fontWeight: 400,
            lineHeight: 1.06,
            letterSpacing: "-0.025em",
            backgroundImage:
              "linear-gradient(90deg, var(--grad-title-from), var(--grad-title-via), var(--grad-title-to))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {t(`chapter.${greetingKey}`)}
          {isAuthed && (
            <>
              <br />
              <span style={{ fontStyle: "italic" }}>{name}.</span>
            </>
          )}
        </div>
        <div className="text-[12px] text-[var(--fg-muted)] mt-[6px]">{t("chapter.subline")}</div>
      </div>

      <Rule mv={20} />

      {/* 今日の問いカード：章の扉に相当する。Begin ボタンで /diary へ */}
      <div
        style={{
          border: "0.5px solid var(--fg)",
          padding: "18px 18px 20px",
        }}
      >
        <Cap mb={10}>{t("chapter.promptLabel")}</Cap>
        <div
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: 20,
            fontWeight: 400,
            lineHeight: 1.28,
            letterSpacing: "-0.01em",
            fontStyle: "italic",
          }}
        >
          {t("chapter.promptBody")}
        </div>
        <div className="mt-4">
          <BtnPrimary big full href="/diary">
            {t("chapter.beginLabel")}
          </BtnPrimary>
        </div>
      </div>

      {/* 直近 7 日：ログイン済みのみ表示（ゲスト時は streak を集計できない） */}
      {isAuthed && (
        <div className="mt-[22px]">
          <div className="flex justify-between items-baseline">
            <Cap mb={0}>{t("chapter.streakLabel")}</Cap>
            <span
              style={{ fontFamily: MONO_FAMILY }}
              className="text-[10px] text-[var(--fg-muted)]"
            >
              {t("chapter.streakCount", { count: streakCount })}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-[6px] mt-[10px]">
            {days.map((x) => (
              <div
                key={`${x.dayLabel}-${x.dayNum}`}
                style={{
                  aspectRatio: "1/1",
                  border: `0.5px solid ${x.isToday ? "var(--fg)" : "var(--border)"}`,
                  padding: "6px 4px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div className="text-[8px] tracking-[0.15em] text-[var(--fg-muted)] uppercase">
                  {x.dayLabel}
                </div>
                <div className="flex justify-between items-end">
                  <div
                    style={{
                      fontFamily: SERIF_FAMILY,
                      fontStyle: x.isToday ? "italic" : "normal",
                      fontSize: 16,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {x.dayNum}
                  </div>
                  {x.hasEntry && <div className="w-1 h-1 rounded-full bg-[var(--fg)]" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />
      <BottomTab />
    </main>
  );
}
