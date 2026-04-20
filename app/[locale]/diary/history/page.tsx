"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Calendar, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type DiaryItem = {
  id: string;
  title: string;
  summary: string;
  language: string;
  message_count: number;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd} ${h}:${min}`;
}

export default function DiaryHistoryPage() {
  const router = useRouter();
  const t = useTranslations("diary.history");
  const [items, setItems] = useState<DiaryItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/app");
        return;
      }
      try {
        const res = await fetch("/api/diary");
        if (aborted) return;
        if (res.status === 401) {
          router.push("/app");
          return;
        }
        if (!res.ok) {
          setErrorMsg(t("loadFailed"));
          setItems([]);
          return;
        }
        const data = (await res.json()) as { items?: DiaryItem[] };
        if (!aborted) setItems(data.items ?? []);
      } catch (err) {
        console.error("diary history load error:", err);
        if (!aborted) {
          setErrorMsg(t("loadFailed"));
          setItems([]);
        }
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [router, t]);

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      {/* 極薄ヘッダー：戻る・新規。Day One 風に控えめ */}
      <header className="flex items-center justify-between mb-12 text-sm tracking-wide">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" aria-hidden="true" />
          {t("back")}
        </Link>
        <Link
          href="/diary"
          className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors"
        >
          <Plus strokeWidth={1.5} className="w-4 h-4" aria-hidden="true" />
          {t("new")}
        </Link>
      </header>

      {/* 大見出し：Day One 的にタイトルを大きく配置 */}
      <div className="mb-12">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)] leading-relaxed tracking-wide">
          {t("title")}
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-6 px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs text-center rounded-md">
          {errorMsg}
        </div>
      )}

      {items === null && !errorMsg && (
        <div className="text-center text-[var(--fg-subtle)] py-20 text-sm tracking-wide">
          {t("loading")}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <div className="text-center py-24">
          <p className="text-lg text-[var(--fg-muted)] mb-8 leading-relaxed">{t("empty")}</p>
          <Link
            href="/diary"
            className="inline-flex items-center gap-2 border border-[var(--accent)] text-[var(--accent)] px-6 py-3 rounded-md text-sm hover:bg-[var(--accent-subtle)] transition-colors"
          >
            <Plus strokeWidth={1.5} className="w-4 h-4" aria-hidden="true" />
            {t("emptyCta")}
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/diary/history/${item.id}`}
                className="group relative block h-full bg-[var(--bg-elevated)] rounded-lg p-6 border border-[var(--border)] hover:border-accent-60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar
                    strokeWidth={1.5}
                    className="w-3.5 h-3.5 text-[var(--fg-subtle)]"
                    aria-hidden="true"
                  />
                  <time className="font-mono-jp text-[11px] uppercase tracking-widest text-[var(--fg-subtle)]">
                    {formatDate(item.created_at)}
                  </time>
                </div>
                <h2 className="mt-3 text-lg font-medium text-[var(--fg)] group-hover:text-[var(--accent-strong)] transition-colors leading-snug line-clamp-2">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {item.summary}
                </p>
                <ChevronRight
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="absolute bottom-5 right-5 w-4 h-4 text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
