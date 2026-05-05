"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useAuth } from "@/app/components/auth/AuthContext";
import {
  BottomTab,
  BtnGhost,
  BtnPrimary,
  Cap,
  PageHeader,
  Rule,
  SettingRow,
} from "@/app/components/chapter";
import { NoteIcon } from "@/app/components/icons/note-icon";
import { XIcon } from "@/app/components/icons/x-icon";
import { useRouter } from "@/i18n/routing";
import { formatMemberSince } from "@/lib/chapterDate";
import { getLegalUrls } from "@/lib/legalUrls";
import { createClient } from "@/lib/supabase/client";
import {
  type ThemePreference,
  applyResolvedTheme,
  getStoredThemePreference,
  resolveTheme,
  setStoredThemePreference,
  subscribeSystemTheme,
} from "@/lib/theme";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { getSelectedVoice } from "@/lib/voicePreferences";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, useEffect, useState } from "react";

// テーマ 3 択。表示順とアイコンはブランドで統一（System → Light → Dark）。
const THEME_OPTIONS: readonly { value: ThemePreference; Icon: typeof Monitor }[] = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

export default function MePage() {
  const t = useTranslations("me");
  // footer 相当の法務 / SNS リンクを /me 末尾に集約する。
  const tFooter = useTranslations("footer");
  const locale = useLocale();
  const legal = getLegalUrls(locale);
  const router = useRouter();
  // 破壊的操作（signOut / delete）用に supabase クライアントは保持する。
  // user 情報は AuthContext から取り、重複 getUser() は行わない。
  const supabase = createClient();
  const { user } = useAuth();

  // 確認モーダルの開閉（破壊的操作は必ず確認を経由）
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentVoiceLabel, setCurrentVoiceLabel] = useState<string>("");
  // テーマ選択は SSR では決まらないので、マウント後に localStorage から読む。
  // 未マウント時は null にしておき、ボタンのアクティブ表示を抑える（ちらつき防止）。
  const [themePref, setThemePref] = useState<ThemePreference | null>(null);

  // 章題下のメタ情報は AuthContext の user から直接導出（副作用なし）
  const userEmail = user?.email ?? "";
  const memberSince = formatMemberSince(user?.created_at, locale);

  useEffect(() => {
    // localStorage から現在の声 ID を取り、i18n のラベルに引き直す
    const id = getSelectedVoice().id;
    setCurrentVoiceLabel(t(`voice.presets.${id}.label`));
  }, [t]);

  // 初回マウント時に localStorage の選択を state に復元する
  useEffect(() => {
    setThemePref(getStoredThemePreference());
  }, []);

  // themePref が "system" の間だけ OS 変更を購読する。
  // 依存配列を [themePref] にすることで、System ↔ Light/Dark 切替時に購読が追従する。
  useEffect(() => {
    if (themePref !== "system") return;
    return subscribeSystemTheme(applyResolvedTheme);
  }, [themePref]);

  const handleThemeChange = (next: ThemePreference) => {
    setThemePref(next);
    setStoredThemePreference(next);
    applyResolvedTheme(resolveTheme(next));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setErrorMsg(null);
    try {
      await supabase.auth.signOut();
      // AuthDialog 導入後はログアウト後の遷移先を LP に変更。
      // replace を使う理由：onAuthStateChange → user null → AuthGate 発火 との
      // 競合で「一瞬ログインダイアログが開いてから LP へ」というチラつきを最小化する。
      router.replace("/");
    } catch {
      setErrorMsg(t("logout.failed"));
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? t("delete.failed"));
        setDeleting(false);
        return;
      }
      // 削除成功 → ログアウトして LP へ
      await supabase.auth.signOut();
      router.replace("/");
    } catch {
      setErrorMsg(t("delete.failed"));
      setDeleting(false);
    }
  };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24 animate-fadeIn">
      <PageHeader />

      {/* 章題：Cap + Fraunces 章題 + メタ情報（email · Member since） */}
      <div className="mt-6">
        <Cap mb={8}>{t("chapter.cap")}</Cap>
        <div
          className="text-3xl sm:text-4xl md:text-5xl tracking-tight"
          style={{ fontFamily: SERIF_FAMILY, fontWeight: 400 }}
        >
          {t("chapter.titleLead")}
          <span>{t("chapter.titleAccent")}</span>
          {t("chapter.titleTail")}
        </div>
        {(userEmail || memberSince) && (
          <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-1">
            {userEmail}
            {userEmail && memberSince && " · "}
            {memberSince && t("chapter.memberSince", { date: memberSince })}
          </div>
        )}
      </div>

      <Rule mv={18} />

      {/* Voice セクション */}
      <Cap mb={6}>{t("chapter.voiceSection")}</Cap>
      <div className="mb-4">
        <SettingRow
          href="/me/voice"
          label={t("voice.cardTitle")}
          sub={currentVoiceLabel || t("voice.cardSubtitle")}
          value="→"
          last
        />
      </div>

      {/* Account セクション：Theme / Password */}
      <Cap mb={6}>{t("chapter.accountSection")}</Cap>
      <div className="mb-4">
        {/* Theme は SettingRow ではなく、行内に小さなセグメントを置く */}
        <div
          className="grid grid-cols-[1fr_auto] gap-3 py-[14px] items-center"
          style={{ borderBottom: "0.5px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-medium tracking-[-0.005em] text-[var(--fg)]">
              {t("theme.cardTitle")}
            </div>
            <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[2px]">
              {t("theme.cardSubtitle")}
            </div>
          </div>
          <div role="radiogroup" aria-label={t("theme.groupAriaLabel")} className="flex">
            {THEME_OPTIONS.map(({ value, Icon }, idx) => {
              const active = themePref === value;
              const isFirst = idx === 0;
              const segStyle: CSSProperties = {
                width: 30,
                height: 28,
                borderTop: "0.5px solid var(--border)",
                borderRight: "0.5px solid var(--border)",
                borderBottom: "0.5px solid var(--border)",
                borderLeft: isFirst ? "0.5px solid var(--border)" : "none",
                background: active ? "var(--fg)" : "transparent",
                color: active ? "var(--bg)" : "var(--fg-muted)",
                cursor: "pointer",
              };
              return (
                <button
                  key={value}
                  type="button"
                  // biome-ignore lint/a11y/useSemanticElements: segmented control にはカスタムスタイルが必要で、button + role=radio の組み合わせで A11y を満たす。
                  role="radio"
                  aria-checked={active}
                  aria-label={t(`theme.options.${value}`)}
                  onClick={() => handleThemeChange(value)}
                  style={segStyle}
                  className="inline-flex items-center justify-center transition-colors"
                >
                  <Icon size={13} strokeWidth={1.5} />
                </button>
              );
            })}
          </div>
        </div>

        <SettingRow
          href="/me/password"
          label={t("password.title")}
          sub={t("password.subtitle")}
          value="→"
          last
        />
      </div>

      {/* Billing セクション：Stripe 実装（#120）まで Coming soon で非活性表示 */}
      <Cap mb={6}>{t("billing.sectionCap")}</Cap>
      <div className="mb-4">
        <div
          className="grid grid-cols-[1fr_auto] gap-3 py-[14px] items-center opacity-40"
          style={{ borderBottom: "0.5px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-medium tracking-[-0.005em] text-[var(--fg)]">
              {t("billing.rowTitle")}
            </div>
            <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[2px]">
              {t("billing.rowSubtitle")}
            </div>
          </div>
          <span
            className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {t("billing.comingSoon")}
          </span>
        </div>
      </div>

      {/* ── Insights への動線（フリーアルファリリース時点では未準備のためコメントアウト）
          準備ができたらコメントを外してリリースする。
          参照: diary/insights ページ（未実装）
      <Cap mb={6}>{t("insights.sectionCap")}</Cap>
      <div className="mb-4">
        <SettingRow
          href="/diary/insights"
          label={t("insights.rowTitle")}
          sub={t("insights.rowSubtitle")}
          value="→"
          last
        />
      </div>
      ── */}

      {/* Privacy セクション：Logout / Delete account */}
      <Cap mb={6}>{t("chapter.privacySection")}</Cap>
      <div>
        <SettingRow
          onClick={() => {
            setErrorMsg(null);
            setShowLogoutConfirm(true);
          }}
          label={t("logout.cardTitle")}
          sub={t("logout.cardSubtitle")}
        />
        <SettingRow
          onClick={() => {
            setErrorMsg(null);
            setShowDeleteConfirm(true);
          }}
          label={t("delete.cardTitle")}
          sub={t("delete.cardSubtitle")}
          last
        />
      </div>

      {errorMsg && !showDeleteConfirm && !showLogoutConfirm && (
        <div
          role="alert"
          className="mt-4 px-4 py-3 text-xs sm:text-sm text-[var(--error)]"
          style={{ border: "0.5px solid var(--error)" }}
        >
          {errorMsg}
        </div>
      )}

      <div className="flex-1" />

      {/* 法務・SNS の薄いリンク島：footer 代わりとしてアプリ末尾に集約（Issue #75）。
          法務リンクは Notion 公開ページ（PWA scope 外）を外部ブラウザで開く。 */}
      <div className="mt-8 pt-4" style={{ borderTop: "0.5px solid var(--border)" }}>
        <div
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm uppercase tracking-[0.2em] text-[var(--fg-muted)]"
          style={{ fontFamily: MONO_FAMILY }}
        >
          <a
            href={legal.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--fg)] transition-colors"
          >
            {tFooter("terms")}
          </a>
          <a
            href={legal.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--fg)] transition-colors"
          >
            {tFooter("privacy")}
          </a>
          <a
            href="https://note.com/uclab/m/m59dc828ffd47"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={tFooter("noteAriaLabel")}
            className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <NoteIcon className="h-3 w-auto" />
          </a>
          <a
            href="https://x.com/myvoicelab"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={tFooter("xAriaLabel")}
            className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <XIcon className="h-3 w-auto" />
          </a>
        </div>
      </div>

      <BottomTab />

      {/* ログアウト確認モーダル */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn"
          onClick={() => {
            if (!signingOut) {
              setErrorMsg(null);
              setShowLogoutConfirm(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !signingOut) {
              setErrorMsg(null);
              setShowLogoutConfirm(false);
            }
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm p-6 rounded-xl shadow-2xl bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <Cap mb={0}>{t("chapter.confirmCap")}</Cap>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setShowLogoutConfirm(false);
                }}
                disabled={signingOut}
                className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0 leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <h2 className="mb-3 text-2xl sm:text-3xl font-semibold leading-tight">
              {t("logoutConfirm.title")}
            </h2>
            <p
              className="text-xs sm:text-sm leading-relaxed mb-5"
              style={{ color: "var(--fg-muted)" }}
            >
              {t("logoutConfirm.desc")}
            </p>
            {errorMsg && <p className="text-xs sm:text-sm text-[var(--error)] mb-4">{errorMsg}</p>}
            <div className="flex gap-2">
              <div className="flex-1">
                <BtnGhost
                  full
                  onClick={() => {
                    setErrorMsg(null);
                    setShowLogoutConfirm(false);
                  }}
                  disabled={signingOut}
                >
                  {t("logoutConfirm.cancel")}
                </BtnGhost>
              </div>
              <div className="flex-1">
                <BtnPrimary full onClick={handleSignOut} disabled={signingOut}>
                  {t("logoutConfirm.confirm")}
                </BtnPrimary>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* アカウント削除確認モーダル */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 animate-fadeIn"
          onClick={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !deleting) setShowDeleteConfirm(false);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm p-6 rounded-xl shadow-2xl bg-[var(--bg)] text-[var(--fg)]"
            style={{ border: "0.5px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <Cap mb={0}>{t("chapter.confirmCap")}</Cap>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors bg-transparent border-0 cursor-pointer p-0 leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <h2 className="mb-3 text-2xl sm:text-3xl font-semibold leading-tight">
              {t("deleteConfirm.title")}
            </h2>
            <p
              className="text-xs sm:text-sm leading-relaxed mb-5"
              style={{ color: "var(--fg-muted)" }}
            >
              {t("deleteConfirm.desc")}
            </p>
            {errorMsg && <p className="text-xs sm:text-sm text-[var(--error)] mb-4">{errorMsg}</p>}
            <div className="flex gap-2">
              <div className="flex-1">
                <BtnGhost
                  full
                  onClick={() => {
                    setErrorMsg(null);
                    setShowDeleteConfirm(false);
                  }}
                  disabled={deleting}
                >
                  {t("deleteConfirm.cancel")}
                </BtnGhost>
              </div>
              <div className="flex-1">
                <BtnPrimary full onClick={handleDeleteAccount} disabled={deleting}>
                  {t("deleteConfirm.confirm")}
                </BtnPrimary>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
