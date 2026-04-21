"use client";

// クライアント side で SVG とダミーデータを描画。Edge Runtime で配信。
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { BottomTab, Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useTranslations } from "next-intl";
import { useId } from "react";

// ダミーの暖かさ推移（0-1 の 12 週分）。Issue #66 で実データに差し替える。
const WARMTH_POINTS = [0.4, 0.6, 0.45, 0.7, 0.55, 0.85, 0.72, 0.9, 0.78, 0.95, 0.88, 0.8];

// 色調の内訳（ダミー）。k はラベルキー、pct は割合（合計が 100% でなくても OK・視覚強度に使う）。
const TONE_ROWS = [
  { key: "still", pct: 34 },
  { key: "tender", pct: 22 },
  { key: "bright", pct: 18 },
  { key: "heavy", pct: 14 },
  { key: "anxious", pct: 12 },
] as const;

type ToneKey = (typeof TONE_ROWS)[number]["key"];

function buildWarmthPath(): string {
  const w = 300;
  const h = 96;
  const yPad = 6;
  const step = w / (WARMTH_POINTS.length - 1);
  return WARMTH_POINTS.map((v, i) => {
    const x = i * step;
    const y = h - yPad - v * (h - yPad * 2);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export default function DiaryInsightsPage() {
  const t = useTranslations("diary.insights");
  const tTones = useTranslations("diary.insights.tones");
  // SVG の clip / gradient id 衝突回避（StrictMode での多重マウント対策）
  const svgId = useId();
  const path = buildWarmthPath();

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24">
      <PageHeader />

      {/* 章題：今月の輪郭。italic の一語を差し込むことで Chapter 系譜を保つ */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <Cap mb={8}>{t("cap")}</Cap>
          <Link
            href="/diary/history"
            className="uppercase text-xs sm:text-sm tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            ← Archive
          </Link>
        </div>
        <div
          className="text-3xl sm:text-4xl tracking-tight"
          style={{
            fontFamily: SERIF_FAMILY,
            fontWeight: 400,
          }}
        >
          {t("headingLead")} <span>{t("headingAccent")}</span>
          {t("headingTail")}
        </div>
        <div
          className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[6px] tracking-wider"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {t("stats")}
        </div>
        {/* P1 は UI + ダミーのみ。実データ化は #66 で追従（memory 参照） */}
        <div className="mt-2 text-xs sm:text-sm uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
          {t("dummyNotice")}
        </div>
      </div>

      <Rule mv={16} />

      {/* 暖かさ推移：細線のフォールバック SVG で月の起伏だけを見せる */}
      <Cap mb={6}>{t("warmthLabel")}</Cap>
      <div style={{ border: "0.5px solid var(--border)", padding: "12px 10px" }}>
        <svg
          width="100%"
          height="96"
          viewBox="0 0 300 96"
          preserveAspectRatio="none"
          aria-labelledby={`${svgId}-title`}
          role="img"
        >
          <title id={`${svgId}-title`}>{t("warmthLabel")}</title>
          <path d={path} fill="none" stroke="var(--fg)" strokeWidth="1" />
          <path d={`${path} L 300 96 L 0 96 Z`} fill="var(--fg)" opacity="0.06" />
        </svg>
        <div
          className="flex justify-between text-xs sm:text-sm text-[var(--fg-muted)] mt-1"
          style={{ fontFamily: MONO_FAMILY }}
        >
          <span>01</span>
          <span>08</span>
          <span>15</span>
          <span>22</span>
          <span>30</span>
        </div>
      </div>

      {/* 色調の分布：Fraunces ラベル + mono 比率。一位だけ italic で階層を作る */}
      <div className="mt-[18px]">
        <Cap mb={6}>{t("tonesLabel")}</Cap>
        {TONE_ROWS.map((row, i) => (
          <div
            key={row.key}
            className="grid items-center gap-[10px] py-[7px] border-b border-[var(--border)]"
            style={{ gridTemplateColumns: "96px 1fr 40px" }}
          >
            <div
              className="text-sm sm:text-base"
              style={{
                fontFamily: SERIF_FAMILY,
                fontWeight: i === 0 ? 600 : 400,
              }}
            >
              {tTones(row.key as ToneKey)}
            </div>
            <div
              className="relative h-[6px]"
              style={{ backgroundColor: "var(--chip)" }}
              aria-hidden
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  // pct を最大 50% 相当として 2.2 倍に伸ばして棒の視認性を確保（デザイン準拠）
                  width: `${Math.min(100, row.pct * 2.2)}%`,
                  backgroundColor: "var(--fg)",
                }}
              />
            </div>
            <div
              className="text-xs sm:text-sm text-[var(--fg-muted)] text-right"
              style={{ fontFamily: MONO_FAMILY }}
            >
              {row.pct}%
            </div>
          </div>
        ))}
      </div>

      {/* Quiet reading：一文の Fraunces italic で "今月の手触り" を返す */}
      <div className="mt-[18px]" style={{ borderLeft: "1.5px solid var(--fg)", paddingLeft: 12 }}>
        <Cap mb={4}>{t("quietReadingLabel")}</Cap>
        <div className="text-sm sm:text-base leading-relaxed" style={{ fontFamily: SERIF_FAMILY }}>
          {t("quietReadingBody")}
        </div>
      </div>

      <div className="flex-1" />
      <BottomTab />
    </main>
  );
}
