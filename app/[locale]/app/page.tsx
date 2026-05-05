"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useAuth } from "@/app/components/auth/AuthContext";
import { BottomTab, Cap, PageHeader } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { formatDateCap } from "@/lib/chapterDate";
import { SERIF_FAMILY } from "@/lib/typography";
import type { User } from "@supabase/supabase-js";
import { User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type GreetingKey = "greetingMorning" | "greetingAfternoon" | "greetingEvening" | "greetingNight";

// 時間帯でヒトの気配を変える。朝の静けさ・夜の沈静を言い換えているだけで分岐は UI 装飾。
function getGreetingKey(hour: number): GreetingKey {
  if (hour >= 4 && hour < 11) return "greetingMorning";
  if (hour >= 11 && hour < 17) return "greetingAfternoon";
  if (hour >= 17 && hour < 22) return "greetingEvening";
  return "greetingNight";
}

function extractName(user: User | null, fallback: string): string {
  if (!user) return fallback;
  const meta = user.user_metadata as { full_name?: string } | undefined;
  if (meta?.full_name) return meta.full_name;
  if (user.email) return user.email.split("@")[0];
  return fallback;
}

export default function HubPage() {
  const t = useTranslations("hub");
  const { user, loading, openDialog } = useAuth();
  const isAuthed = loading ? null : user !== null;

  // SSR と クライアントで時刻が変わると hydration mismatch になるため、
  // 描画開始はクライアントで now が確定した後に限定する。初回 SSR では null。
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const greetingKey = now ? getGreetingKey(now.getHours()) : null;
  const name = extractName(user, t("chapter.noName"));
  const dateCap = now ? formatDateCap(now) : null;

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24">
      {/* 章立てヘッダ：左に MyVoiceLab、右にログイン状態 */}
      <PageHeader
        right={
          isAuthed === null ? (
            <span aria-hidden className="inline-block w-9 h-5" />
          ) : isAuthed === false ? (
            <button
              type="button"
              onClick={() => openDialog("login")}
              className="uppercase tracking-[0.32em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer text-xs sm:text-sm p-0"
            >
              {t("login")}
            </button>
          ) : (
            <Link
              href="/me"
              aria-label={t("myPage")}
              className="relative inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-strong)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--fg-muted)] transition-colors"
            >
              <UserIcon size={14} strokeWidth={1.5} aria-hidden />
              <span
                aria-hidden
                className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]"
              />
            </Link>
          )
        }
      />

      {/* 挨拶：時刻 + 相手の名前。Fraunces italic で紙に近い気配を作る。
          グラデは globals.css の --grad-title-* を再利用（Light/Dark 自動追従）。
          now が null のあいだ（SSR + hydration 直後）は空枠で占位し、
          レイアウトの上下ジャンプを防ぐ。 */}
      <div className="mt-6">
        <Cap mb={8}>{dateCap ?? " "}</Cap>
        <div
          className="text-4xl sm:text-5xl tracking-tight"
          style={{
            fontFamily: SERIF_FAMILY,
            fontWeight: 400,
            minHeight: 36 * 2 + 4,
            backgroundImage:
              "linear-gradient(90deg, var(--grad-title-from), var(--grad-title-via), var(--grad-title-to))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {greetingKey && t(`chapter.${greetingKey}`)}
          {greetingKey && isAuthed && (
            <>
              <br />
              <span>{name}.</span>
            </>
          )}
        </div>
        <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[6px]">
          {t("chapter.subline")}
        </div>
      </div>

      <div className="flex-1" />
      <BottomTab />
    </main>
  );
}
