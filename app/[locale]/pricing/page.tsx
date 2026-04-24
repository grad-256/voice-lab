"use client";

export const runtime = "edge";

import { Cap, PageHeader, PlanCard, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { SERIF_FAMILY } from "@/lib/typography";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

const PLAN_KEYS = ["still", "quiet", "year"] as const;

export default function PricingPage() {
  const t = useTranslations("pricing");

  const handleSelect = (plan: (typeof PLAN_KEYS)[number]) => {
    console.warn(`[P3] Stripe connection pending (#55). Selected plan: ${plan}`);
  };

  const backLink: CSSProperties = { color: "inherit", textDecoration: "none" };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-14 animate-fadeIn">
      <PageHeader
        left={
          <Link href="/app" style={backLink} className="hover:text-[var(--fg)] transition-colors">
            ← MyVoiceLab
          </Link>
        }
      />

      <div className="mt-6">
        <Cap mb={8}>{t("chapter.cap")}</Cap>
        <div
          className="text-3xl sm:text-4xl tracking-tight"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
        >
          {t("chapter.titleLead")}
          <span>{t("chapter.titleAccent")}</span>
          {t("chapter.titleTail")}
        </div>
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6] mt-3">
          {t("chapter.lead")}
        </p>
      </div>

      <Rule mv={22} />

      <div className="space-y-6">
        {PLAN_KEYS.map((key) => {
          const limitsRaw = (t.raw(`plans.${key}.limits`) ?? {}) as Record<string, number>;
          const featuresRaw = t.raw(`plans.${key}.features`) as Record<string, string>;
          const features = Object.keys(featuresRaw).map((fk) =>
            t(`plans.${key}.features.${fk}`, limitsRaw)
          );
          const badgeRaw = key === "quiet" ? t("plans.quiet.badge") : undefined;
          return (
            <PlanCard
              key={key}
              name={t(`plans.${key}.name`)}
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

      <div className="mt-8 space-y-2 text-center">
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6]">{t("note")}</p>
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6]">
          {t("stripePendingNote")}
        </p>
      </div>
    </main>
  );
}
