"use client";

// `/release-notes` — バージョン別の更新履歴。
// 並び順は `lib/releaseNotes.ts` の `RELEASE_NOTES` 配列（新しい順）で、本文は i18n JSON から引く。
// 各エントリは「Cap（バージョン + 日付）+ 小章題 + 箇条書き 3〜5 行」の構成。

export const runtime = "edge";

import { Cap, PageHeader, Rule } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { RELEASE_NOTES } from "@/lib/releaseNotes";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

export default function ReleaseNotesPage() {
  const t = useTranslations("releaseNotes");
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

      {/* バージョン別リスト */}
      <div className="space-y-8">
        {RELEASE_NOTES.map((key, idx) => {
          const items = t.raw(`entries.${key}.items`) as readonly string[];
          const version = t(`entries.${key}.version`);
          const date = t(`entries.${key}.date`);
          const title = t(`entries.${key}.title`);
          return (
            <article key={key} className={idx === 0 ? "" : "pt-6"}>
              {/* 日付 · バージョン（mono） */}
              <div
                className="flex items-baseline justify-between mb-2"
                style={{ fontFamily: MONO_FAMILY }}
              >
                <span className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-muted)]">
                  {date}
                </span>
                <span className="text-xs sm:text-sm text-[var(--fg-muted)] tracking-[0.12em]">
                  {t("versionLabel", { version })}
                </span>
              </div>

              {/* 小章題（Fraunces） */}
              <h2
                className="text-lg sm:text-xl leading-tight tracking-tight"
                style={{
                  fontFamily: SERIF_FAMILY,
                  fontWeight: 400,
                  color: "var(--fg)",
                }}
              >
                {title}
              </h2>

              {/* 項目リスト */}
              <ul className="mt-3 space-y-[6px]">
                {items.map((item) => (
                  <li
                    key={item}
                    className="text-xs sm:text-sm text-[var(--fg)] leading-[1.7] flex gap-[10px]"
                  >
                    <span aria-hidden className="text-[var(--fg-muted)] select-none">
                      ·
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* バージョン間の細線 */}
              {idx < RELEASE_NOTES.length - 1 && (
                <div
                  aria-hidden
                  style={{
                    marginTop: 28,
                    width: 40,
                    height: 1,
                    backgroundColor: "var(--fg)",
                    opacity: 0.5,
                  }}
                />
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
