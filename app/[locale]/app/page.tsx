"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ArrowRight, ChevronRight, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function HubPage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const t = useTranslations("hub");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user);
    });
  }, []);

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 flex flex-col animate-fadeIn">
      {/* ヘッダー：戻る / 認証系リンクは極小の補助役 */}
      <header className="flex items-center justify-between mb-16 text-sm tracking-wide">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          {t("backToTop")}
        </Link>
        {isAuthed === false && (
          <Link
            href="/login"
            className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
          >
            {t("login")}
          </Link>
        )}
        {isAuthed === true && (
          <Link
            href="/me"
            aria-label={t("myPage")}
            className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--fg-muted)] transition-colors"
          >
            <User size={18} strokeWidth={1.5} aria-hidden="true" />
            {/* ログイン中を示す小さな緑ドット（オンラインインジケータ） */}
            <span
              aria-hidden="true"
              className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[var(--bg)]"
            />
          </Link>
        )}
      </header>

      {/* タイトル：日記一軸のブランドコア */}
      <div className="mb-20">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)] leading-relaxed tracking-wide">
          {t("heading")}
        </h1>
        <p className="mt-6 text-sm text-[var(--fg-muted)] leading-relaxed">{t("subheading")}</p>
      </div>

      {/* 主 CTA：日記を始める。rounded-full ボタンを廃し border-bottom の静かな動線 */}
      <Link
        href="/diary"
        className="group inline-flex items-center gap-3 self-start border-b border-[var(--border-strong)] hover:border-[var(--accent)] pb-3 pr-2 transition-colors"
      >
        <span className="text-xl sm:text-2xl font-medium text-[var(--fg)] group-hover:text-[var(--accent-strong)] transition-colors">
          {t("diary.title")}
        </span>
        <ArrowRight
          aria-hidden="true"
          strokeWidth={1.5}
          className="w-5 h-5 text-[var(--fg-subtle)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all"
        />
      </Link>
      <p className="mt-6 text-sm text-[var(--fg-muted)] leading-relaxed max-w-md">
        {t("diary.desc")}
      </p>

      {/* 副次リンク：過去の日記。認証済のみ */}
      {isAuthed === true && (
        <div className="mt-16 pt-8 border-t border-[var(--border)]">
          <Link
            href="/diary/history"
            className="group inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--accent-strong)] transition-colors"
          >
            {t("viewHistory")}
            <ChevronRight
              aria-hidden="true"
              strokeWidth={1.5}
              className="w-4 h-4 text-[var(--fg-subtle)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all"
            />
          </Link>
        </div>
      )}

      {/* ゲストのみステータスを表示（認証済みは右上の緑ドットで示すので重複させない） */}
      {isAuthed === false && (
        <div className="mt-auto pt-20 text-xs text-[var(--fg-subtle)]">
          <span>
            {t("guestStatusBefore")}
            <Link
              href="/login"
              className="text-[var(--accent)] hover:text-[var(--accent-strong)] underline underline-offset-2"
            >
              {t("guestStatusLogin")}
            </Link>
            {t("guestStatusAfter")}
          </span>
        </div>
      )}
    </main>
  );
}
