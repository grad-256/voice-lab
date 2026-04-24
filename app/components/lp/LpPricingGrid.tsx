"use client";

import { PlanCard } from "@/app/components/chapter";
import { useTranslations } from "next-intl";

const ACTIVE_PLAN_KEYS = ["still", "quiet", "year"] as const;

export function LpPricingGrid() {
  const t = useTranslations("pricing");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4 md:gap-5">
      {ACTIVE_PLAN_KEYS.map((key) => {
        const limitsRaw = (t.raw(`plans.${key}.limits`) ?? {}) as Record<string, number>;
        const featuresRaw = t.raw(`plans.${key}.features`) as Record<string, string>;
        const features = Object.keys(featuresRaw).map((fk) =>
          t(`plans.${key}.features.${fk}`, limitsRaw)
        );
        const badge = key === "quiet" ? t("plans.quiet.badge") : undefined;
        return (
          <PlanCard
            key={key}
            name={t(`plans.${key}.name`)}
            price={t(`plans.${key}.price`)}
            period={t(`plans.${key}.period`)}
            tagline={t(`plans.${key}.tagline`)}
            features={features}
            badge={badge}
            highlighted={key === "quiet"}
          />
        );
      })}
    </div>
  );
}
