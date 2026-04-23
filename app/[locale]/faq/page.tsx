"use client";

// `/faq` — 番号付き Q&A（01〜05）を縦に並べ、各行タップで本文を開閉する。
// 初期は全て閉じており、複数同時に開くことを許可する（並べて読み比べたい場面に配慮）。

export const runtime = "edge";

import { Cap, FaqItem, PageHeader, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { SERIF_FAMILY } from "@/lib/typography";
import { useTranslations } from "next-intl";
import { type CSSProperties, useState } from "react";

// 並び順と番号表記はコード側で固定。i18n 側に "01" 等の数字は書かない（並び替え耐性のため）。
const FAQ_KEYS = ["q01", "q02", "q03", "q04", "q05"] as const;

export default function FaqPage() {
  const t = useTranslations("faq");
  // 開いている項目の集合。複数同時に開ける。
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

      {/* 章題 */}
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
      </div>

      <Rule mv={22} />

      {/* Q&A リスト */}
      <div>
        {FAQ_KEYS.map((key, idx) => {
          const number = String(idx + 1).padStart(2, "0");
          return (
            <FaqItem
              key={key}
              number={number}
              question={t(`items.${key}.question`)}
              answer={t(`items.${key}.answer`)}
              isOpen={openKeys.has(key)}
              onToggle={() => toggle(key)}
              expandLabel={t("expand")}
              collapseLabel={t("collapse")}
              last={idx === FAQ_KEYS.length - 1}
            />
          );
        })}
      </div>
    </main>
  );
}
