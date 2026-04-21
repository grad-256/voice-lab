"use client";

// `/me/billing` — 請求情報の UI。本 PR はダミーデータのみで、Stripe 本実装は Issue #55。
// `/me/*` は `lib/auth/protectedPaths.ts` の PROTECTED_PREFIXES により AuthGate が
// 自動的に未ログインの退避（ダイアログ表示 → /app）を担当する。本ページで二重チェックは不要。
//
// セクション構成：
//   1. Next charge · 次回請求（日付・プラン・金額）
//   2. Payment method · 支払方法（カード末尾 4 桁 + 期限 + "変更" SettingRow）
//   3. History · 請求履歴（3 行のダミー）
// 末尾に「プラン変更（/pricing 遷移）」「解約（toast のみ）」の 2 アクション。

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { BottomTab, Cap, PageHeader, Rule, SettingRow } from "@/app/components/chapter";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { type CSSProperties, useState } from "react";

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';
const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

// 請求履歴の 3 行ダミー。本 PR では i18n を経由せず最小表現にとどめる（金額は JA/EN 共通）。
// Stripe 連携時 (#55) に Supabase / Stripe から実データで差し替える。
const DUMMY_INVOICES: readonly { id: string; date: string; amount: string }[] = [
  { id: "inv_2026_04", date: "2026-04-15", amount: "¥980" },
  { id: "inv_2026_03", date: "2026-03-15", amount: "¥980" },
  { id: "inv_2026_02", date: "2026-02-15", amount: "¥980" },
];

export default function BillingPage() {
  const t = useTranslations("me.billing");

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 解約ボタンなど Stripe 未接続の操作は、短い toast で「決済機能は近日公開」だけ伝える。
  const showPendingToast = () => {
    setToastMsg(t("stripePendingToast"));
    setTimeout(() => setToastMsg(null), 1800);
  };

  const backLink: CSSProperties = { color: "inherit", textDecoration: "none" };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24 animate-fadeIn">
      <PageHeader
        left={
          <Link href="/me" style={backLink} className="hover:text-[var(--fg)] transition-colors">
            ← Me
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
      </div>

      <Rule mv={22} />

      {/* Next charge */}
      <Cap mb={10}>{t("sections.nextCharge")}</Cap>
      <div className="mb-7">
        <div
          className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2"
          style={{ fontFamily: MONO_FAMILY }}
        >
          <span className="text-xs sm:text-sm uppercase tracking-[0.22em] text-[var(--fg-muted)]">
            {t("nextCharge.dateLabel")}
          </span>
          <span className="text-xs sm:text-sm text-[var(--fg)]">{t("nextCharge.dummyDate")}</span>
          <span className="text-xs sm:text-sm uppercase tracking-[0.22em] text-[var(--fg-muted)]">
            {t("nextCharge.planLabel")}
          </span>
          <span className="text-xs sm:text-sm text-[var(--fg)]">{t("nextCharge.dummyPlan")}</span>
        </div>
        {/* 金額は Fraunces で静かに強調 */}
        <div className="flex items-baseline gap-2 mt-3">
          <span
            className="text-2xl sm:text-3xl tracking-tight"
            style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
          >
            {t("nextCharge.dummyAmount")}
          </span>
          <span
            className="text-xs sm:text-sm text-[var(--fg-muted)]"
            style={{ fontFamily: MONO_FAMILY }}
          >
            / {t("nextCharge.dummyPeriod")}
          </span>
        </div>
      </div>

      {/* Payment method */}
      <Cap mb={10}>{t("sections.paymentMethod")}</Cap>
      <div className="mb-7">
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <span
            className="text-xs sm:text-sm uppercase tracking-[0.22em] text-[var(--fg-muted)]"
            style={{ fontFamily: MONO_FAMILY }}
          >
            {t("paymentMethod.cardLabel")}
          </span>
          <span className="text-xs sm:text-sm text-[var(--fg)]" style={{ fontFamily: MONO_FAMILY }}>
            {t("paymentMethod.cardValue", { last4: t("paymentMethod.dummyLast4") })}
          </span>
        </div>
        <div
          className="text-xs sm:text-sm text-[var(--fg-muted)] mt-2"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {t("paymentMethod.expires", {
            month: t("paymentMethod.dummyMonth"),
            year: t("paymentMethod.dummyYear"),
          })}
        </div>
        <div className="mt-3">
          <SettingRow onClick={showPendingToast} label={t("paymentMethod.change")} value="→" last />
        </div>
      </div>

      {/* History */}
      <Cap mb={10}>{t("sections.history")}</Cap>
      <div className="mb-7">
        {DUMMY_INVOICES.map((inv, idx) => (
          <div
            key={inv.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-[12px]"
            style={{
              borderBottom:
                idx === DUMMY_INVOICES.length - 1 ? "none" : "0.5px solid var(--border)",
              fontFamily: MONO_FAMILY,
            }}
          >
            <span className="text-xs sm:text-sm text-[var(--fg-muted)] tracking-[0.16em]">
              {inv.date}
            </span>
            <span className="text-xs sm:text-sm text-[var(--fg)]">{inv.amount}</span>
            <button
              type="button"
              onClick={showPendingToast}
              className="text-xs sm:text-sm uppercase tracking-[0.2em] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer"
            >
              {t("history.downloadInvoice")}
            </button>
          </div>
        ))}
      </div>

      {/* アクション */}
      <div>
        <SettingRow
          href="/pricing"
          label={t("actions.changePlan")}
          sub={t("actions.changePlanSub")}
          value="→"
        />
        <SettingRow
          onClick={showPendingToast}
          label={t("actions.cancelPlan")}
          sub={t("actions.cancelPlanSub")}
          last
        />
      </div>

      {/* Toast */}
      <output
        aria-live="polite"
        className={`block text-center text-xs sm:text-sm uppercase tracking-[0.2em] text-[var(--fg-muted)] mt-6 transition-opacity ${
          toastMsg ? "opacity-100" : "opacity-0"
        }`}
      >
        {toastMsg ?? ""}
      </output>

      <BottomTab />
    </main>
  );
}
