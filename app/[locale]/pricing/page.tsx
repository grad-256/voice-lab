"use client";

// `/pricing` — Still / Quiet / Year の 3 プランを縦積みで比較する UI。
// Stripe 連携は Issue #55 で別 PR 実装。本ページは CTA が押されても console.warn のみで、
// サインアップ・決済フローは起動しない。Chapter 系譜の静けさを維持しつつ、Quiet プランだけ
// 視覚的に 1 段強調する（枠線 1px + Cap 反転）。

export const runtime = "edge";

import { Cap, PageHeader, PlanCard, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';

const PLAN_KEYS = ["still", "quiet", "year"] as const;

export default function PricingPage() {
  const t = useTranslations("pricing");

  const handleSelect = (plan: (typeof PLAN_KEYS)[number]) => {
    // Stripe 実装は Issue #55。本 PR では何も起こさず、開発者向けに警告だけ残す。
    // 本番ユーザー向けのメッセージは stripePendingNote として画面下部に常設されている。
    console.warn(`[P3] Stripe connection pending (#55). Selected plan: ${plan}`);
  };

  const backLink: CSSProperties = { color: "inherit", textDecoration: "none" };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-14 animate-fadeIn">
      <PageHeader
        left={
          <Link href="/" style={backLink} className="hover:text-[var(--fg)] transition-colors">
            ← MyVoiceLab
          </Link>
        }
      />

      {/* 章題 */}
      <div className="mt-6">
        <Cap mb={8}>{t("chapter.cap")}</Cap>
        <div
          className="text-3xl sm:text-4xl tracking-tight"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
        >
          {t("chapter.titleLead")}
          <span style={{ fontStyle: "italic" }}>{t("chapter.titleItalic")}</span>
          {t("chapter.titleTail")}
        </div>
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6] mt-3">
          {t("chapter.lead")}
        </p>
      </div>

      <Rule mv={22} />

      {/* 3 プランを縦積み。Quiet のみ highlighted */}
      <div className="space-y-6">
        {PLAN_KEYS.map((key) => {
          const features = t.raw(`plans.${key}.features`) as readonly string[];
          const badgeRaw = key === "quiet" ? t("plans.quiet.badge") : undefined;
          const jpRaw = t(`plans.${key}.jp`);
          return (
            <PlanCard
              key={key}
              name={t(`plans.${key}.name`)}
              jp={jpRaw || undefined}
              price={t(`plans.${key}.price`)}
              period={t(`plans.${key}.period`)}
              tagline={t(`plans.${key}.tagline`)}
              features={features}
              ctaLabel={t(`plans.${key}.cta`)}
              badge={badgeRaw}
              highlighted={key === "quiet"}
              onSelect={() => handleSelect(key)}
            />
          );
        })}
      </div>

      {/* フッターノート */}
      <div className="mt-8 space-y-2 text-center">
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6]">{t("note")}</p>
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6]">
          {t("stripePendingNote")}
        </p>
      </div>
    </main>
  );
}
