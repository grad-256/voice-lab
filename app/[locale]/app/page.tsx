"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function HubPage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const t = useTranslations("hub");
  // /english は現状日本人向け（英会話練習）機能。EN UI では不整合なので非表示にする。
  // 将来的に日本語話者向けプロダクトとして再構築する予定。
  const locale = useLocale();
  const showEnglish = locale === "ja";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user);
    });
  }, []);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 flex flex-col">
      {/* ヘッダー */}
      <header className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          {t("backToTop")}
        </Link>
        {isAuthed === false && (
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
            {t("login")}
          </Link>
        )}
        {isAuthed === true && (
          <Link
            href="/settings"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            {t("settings")}
          </Link>
        )}
      </header>

      {/* タイトル */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">{t("heading")}</h1>
        <p className="text-sm text-gray-400">{t("subheading")}</p>
      </div>

      {/* カード：JA は 2 枚（声の日記 + 英会話）、EN は声の日記のみ中央寄せ */}
      <div
        className={`grid gap-4 mb-10 ${
          showEnglish ? "sm:grid-cols-2" : "grid-cols-1 max-w-md mx-auto w-full"
        }`}
      >
        {/* 声の日記 */}
        <Link
          href="/diary"
          className="group relative block p-6 bg-gradient-to-br from-indigo-950/60 to-gray-900 border border-indigo-800/50 rounded-2xl hover:border-indigo-500 transition-all hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-200 transition-colors">
            {t("diary.title")}
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">{t("diary.desc")}</p>
        </Link>

        {/* 英会話（EN UI では非表示） */}
        {showEnglish && (
          <Link
            href="/english"
            className="group relative block p-6 bg-gradient-to-br from-emerald-950/60 to-gray-900 border border-emerald-800/50 rounded-2xl hover:border-emerald-500 transition-all hover:-translate-y-0.5"
          >
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-200 transition-colors">
              {t("english.title")}
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">{t("english.desc")}</p>
          </Link>
        )}
      </div>

      {/* ログイン済ユーザー向け：過去の日記へ */}
      {isAuthed === true && (
        <div className="text-center mb-6">
          <Link
            href="/diary/history"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {t("viewHistory")}
          </Link>
        </div>
      )}

      {/* ステータス */}
      <div className="mt-auto text-center text-xs text-gray-500">
        {isAuthed === null && <span>&nbsp;</span>}
        {isAuthed === false && (
          <span>
            {t("guestStatusBefore")}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 underline">
              {t("guestStatusLogin")}
            </Link>
            {t("guestStatusAfter")}
          </span>
        )}
        {isAuthed === true && <span>{t("loggedIn")}</span>}
      </div>
    </main>
  );
}
