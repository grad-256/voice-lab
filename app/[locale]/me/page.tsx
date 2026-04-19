"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import {
  type ThemePreference,
  applyResolvedTheme,
  getStoredThemePreference,
  resolveTheme,
  setStoredThemePreference,
  subscribeSystemTheme,
} from "@/lib/theme";
import { getSelectedVoice } from "@/lib/voicePreferences";
import {
  ArrowLeft,
  ChevronRight,
  Lock,
  LogOut,
  Mic,
  Monitor,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

// テーマ 3 択。表示順とアイコンはブランドで統一（System → Light → Dark）。
const THEME_OPTIONS: readonly { value: ThemePreference; Icon: typeof Monitor }[] = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

export default function SettingsPage() {
  const t = useTranslations("me");
  const router = useRouter();
  const supabase = createClient();
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
  // 依存配列を [themePref] にすることで、System ↔ Light/Dark 切替時に購読が追従する
  // （前版は依存配列 [] で初回値が "system" の人にしか働かなかった）。
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
      router.push("/login");
    } catch {
      // ネットワーク断などで失敗した場合はローカライズ済みメッセージでフィードバック
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

      // 削除成功 → ログアウトしてログインページへ
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      setErrorMsg(t("delete.failed"));
      setDeleting(false);
    }
  };

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      {/* 極薄ヘッダー */}
      <header className="flex items-center justify-between mb-10 text-sm tracking-wide">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          {t("back")}
        </Link>
      </header>

      <h1 className="text-xl sm:text-2xl font-semibold text-[var(--fg)] leading-relaxed mb-10">
        {t("title")}
      </h1>

      {/* Day One 的カード列 */}
      <div className="space-y-3">
        {/* 声を選ぶ */}
        <Link
          href="/me/voice"
          className="flex items-center justify-between gap-4 p-5 rounded-lg bg-elevated-50 hover:bg-elevated border border-[var(--border)] hover:border-accent-60 transition-colors"
        >
          <div className="flex items-center gap-4 min-w-0">
            <Mic size={18} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
            <div className="min-w-0">
              <div className="text-base font-medium text-[var(--fg)]">{t("voice.cardTitle")}</div>
              <div className="text-xs text-[var(--fg-muted)] mt-0.5 truncate">
                {currentVoiceLabel || t("voice.cardSubtitle")}
              </div>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
        </Link>

        {/* テーマ切替（System / Light / Dark） */}
        <div className="p-5 rounded-lg bg-elevated-50 border border-[var(--border)]">
          <div className="flex items-center gap-4 min-w-0 mb-4">
            {/* System 時はモニタ、明示指定時はその状態のアイコン */}
            {(() => {
              const Icon = THEME_OPTIONS.find((o) => o.value === themePref)?.Icon ?? Monitor;
              return (
                <Icon size={18} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
              );
            })()}
            <div className="min-w-0">
              <div className="text-base font-medium text-[var(--fg)]">{t("theme.cardTitle")}</div>
              <div className="text-xs text-[var(--fg-muted)] mt-0.5">{t("theme.cardSubtitle")}</div>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label={t("theme.groupAriaLabel")}
            className="grid grid-cols-3 gap-1.5 p-1 rounded-md border border-[var(--border)] bg-[var(--bg)]"
          >
            {THEME_OPTIONS.map(({ value, Icon }) => {
              const active = themePref === value;
              return (
                <button
                  key={value}
                  type="button"
                  // biome-ignore lint/a11y/useSemanticElements: segmented control にはカスタムスタイルが必要で、button + role=radio の組み合わせで A11y を満たす。
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleThemeChange(value)}
                  className={
                    active
                      ? "flex items-center justify-center gap-2 py-2.5 rounded text-sm bg-[var(--accent)] text-white transition-colors"
                      : "flex items-center justify-center gap-2 py-2.5 rounded text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)] transition-colors"
                  }
                >
                  <Icon size={14} strokeWidth={1.5} />
                  {t(`theme.options.${value}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* パスワード変更（ログイン中のまま変更可能） */}
        <Link
          href="/me/password"
          className="flex items-center justify-between gap-4 p-5 rounded-lg bg-elevated-50 hover:bg-elevated border border-[var(--border)] hover:border-accent-60 transition-colors"
        >
          <div className="flex items-center gap-4 min-w-0">
            <Lock size={18} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
            <div className="min-w-0">
              <div className="text-base font-medium text-[var(--fg)]">{t("password.title")}</div>
              <div className="text-xs text-[var(--fg-muted)] mt-0.5 truncate">
                {t("password.subtitle")}
              </div>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
        </Link>

        {/* ログアウト */}
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setShowLogoutConfirm(true);
          }}
          className="w-full flex items-center justify-between gap-4 p-5 rounded-lg bg-elevated-50 hover:bg-elevated border border-[var(--border)] hover:border-accent-60 transition-colors text-left"
        >
          <div className="flex items-center gap-4 min-w-0">
            <LogOut size={18} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
            <div className="min-w-0">
              <div className="text-base font-medium text-[var(--fg)]">{t("logout.cardTitle")}</div>
              <div className="text-xs text-[var(--fg-muted)] mt-0.5">
                {t("logout.cardSubtitle")}
              </div>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-[var(--fg-subtle)]" />
        </button>

        {/* アカウント削除 */}
        <div className="p-5 rounded-lg bg-elevated-50 border border-[var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Trash2
                size={18}
                strokeWidth={1.5}
                className="shrink-0 text-[var(--fg-subtle)] mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-base font-medium text-[var(--fg)]">
                  {t("delete.cardTitle")}
                </div>
                <div className="text-xs text-[var(--fg-muted)] mt-0.5 leading-relaxed max-w-md">
                  {t("delete.cardSubtitle")}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setShowDeleteConfirm(true);
              }}
              className="shrink-0 text-sm text-[var(--error)] hover:underline"
            >
              {t("delete.action")}
            </button>
          </div>

          {errorMsg && !showDeleteConfirm && !showLogoutConfirm && (
            <div
              role="alert"
              className="mt-4 px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md"
            >
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* ログアウト確認モーダル */}
      {showLogoutConfirm && (
        <dialog
          open
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          className="fixed inset-0 z-50 m-0 max-w-none max-h-none w-screen h-screen p-0 border-0 bg-[var(--bg-overlay)] flex items-center justify-center px-6 animate-fadeIn"
        >
          <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-6 space-y-4">
            <h2 id="logout-confirm-title" className="text-base font-semibold text-[var(--fg)]">
              {t("logoutConfirm.title")}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              {t("logoutConfirm.desc")}
            </p>
            {errorMsg && (
              <div
                role="alert"
                className="px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md"
              >
                {errorMsg}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setShowLogoutConfirm(false);
                }}
                disabled={signingOut}
                className="border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] px-4 py-2.5 rounded-md text-sm transition-colors disabled:opacity-50"
              >
                {t("logoutConfirm.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 text-white px-4 py-2.5 rounded-md text-sm transition-colors"
              >
                {t("logoutConfirm.confirm")}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* アカウント削除確認モーダル */}
      {showDeleteConfirm && (
        <dialog
          open
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="fixed inset-0 z-50 m-0 max-w-none max-h-none w-screen h-screen p-0 border-0 bg-[var(--bg-overlay)] flex items-center justify-center px-6 animate-fadeIn"
        >
          <div className="w-full max-w-sm bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-6 space-y-4">
            <h2 id="delete-confirm-title" className="text-base font-semibold text-[var(--fg)]">
              {t("deleteConfirm.title")}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
              {t("deleteConfirm.desc")}
            </p>
            {errorMsg && (
              <div
                role="alert"
                className="px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md"
              >
                {errorMsg}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] px-4 py-2.5 rounded-md text-sm transition-colors disabled:opacity-50"
              >
                {t("deleteConfirm.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-[var(--error)] hover:opacity-90 disabled:opacity-50 text-white px-4 py-2.5 rounded-md text-sm transition-colors"
              >
                {t("deleteConfirm.confirm")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}
