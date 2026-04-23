"use client";

import { PlanCard } from "@/app/components/chapter";
import { useTranslations } from "next-intl";

// LP 内料金セクション用の wrapper。PlanCard は useTranslations 要件で server component から
// 直接使えないためここで閉じ込める。LP では ctaLabel/onSelect を渡さず CTA 非表示。
const PLAN_KEYS = ["still", "quiet", "year"] as const;

export function LpPricingGrid() {
  const t = useTranslations("pricing");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4 md:gap-5">
      {PLAN_KEYS.map((key) => {
        const features = t.raw(`plans.${key}.features`) as readonly string[];
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
