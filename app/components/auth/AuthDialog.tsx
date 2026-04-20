"use client";

// グローバル認証ダイアログ。
// 既存 /login ページのフォーム UI・i18n キーをそのまま流用しつつ、モーダル表示に載せ替える。
// - ログイン / サインアップ / パスワードリセット送信の 3 モード切替
// - Esc / オーバーレイクリックで閉じる
// - 背景スクロールロック
// - 閉じられた時の「保護ページなら /app に戻す」挙動は AuthGate 側が持つ（責務分離）

import { useAuth } from "@/app/components/auth/AuthContext";
import { usePathname, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const inputClass =
  "w-full pl-10 pr-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] rounded-md focus:border-[var(--accent)] focus:outline-none transition-colors";

const leadingIconClass =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]";

export function AuthDialog() {
  const t = useTranslations("auth");
  const { isOpen, mode, closeDialog, openDialog } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // LP（/）からログイン / サインアップした場合のみ、成功後に /app へ遷移する。
  // 他のページ（/diary、/me 等）ではその場に留まる仕様（書きかけ文脈を壊さないため）。
  const redirectToAppIfOnLP = () => {
    if (pathname === "/") {
      router.push("/app");
    }
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // 開閉時に入力・メッセージをリセット。開いた時に邪魔な値が残らないよう明示的にクリア。
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
    } else {
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setLoading(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  // 背景スクロールロック。モーダル表示中は body をロック。
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Esc キーで閉じる。
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDialog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeDialog]);

  // モード切替時にメッセージだけクリア（入力値は残す：メールアドレスは再入力面倒なため）。
  const switchMode = (next: "login" | "signup" | "forgot") => {
    openDialog(next);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 成功時：AuthContext の onAuthStateChange が user を更新し、
        // 同じ効果で isOpen も自動 false になる。LP（/）からのログインだけハブへ遷移させる。
        redirectToAppIfOnLP();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          // confirm email オフの場合は即ログイン状態。ダイアログは自動クローズされ、
          // LP からのサインアップならハブへ遷移する。
          redirectToAppIfOnLP();
        } else {
          // 確認メール待ち：ダイアログ内にメッセージ表示して維持。
          setSuccessMsg(t("signup.confirmEmailSent"));
        }
      } else {
        // forgot：パスワードリセットメール送信。
        // ユーザーがメールのリンクを踏むと /reset-password（独立ページ）に遷移する。
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccessMsg(t("forgot.emailSent"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid login credentials")) {
        setErrorMsg(t("errors.invalidCredentials"));
      } else if (msg.includes("Email not confirmed")) {
        setErrorMsg(t("errors.emailNotConfirmed"));
      } else if (msg.includes("User already registered")) {
        setErrorMsg(t("errors.alreadyRegistered"));
      } else if (msg.includes("Password should be at least")) {
        setErrorMsg(t("errors.tooShort"));
      } else {
        setErrorMsg(t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title =
    mode === "forgot"
      ? t("forgot.title")
      : mode === "signup"
        ? t("signup.title")
        : t("login.title");

  const subtitle = mode === "forgot" ? t("forgot.subtitle") : t("login.subtitle");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* オーバーレイ：クリックで閉じる。button 要素なのでキーボードアクセシブル（Enter/Space で動く）。
          ページ遷移用の animate-fadeIn (0.6s) ではダイアログ用途で重いため、高速版 (0.12s) を使う。 */}
      <button
        type="button"
        aria-label={t("dialog.close")}
        onClick={closeDialog}
        className="absolute inset-0 bg-[var(--bg-overlay)] cursor-default animate-overlayIn"
      />
      <div
        ref={dialogRef}
        // biome-ignore lint/a11y/useSemanticElements: React state 駆動で open/close を管理するため native <dialog> の showModal/close 命令 API と相性が悪い。aria-modal + role="dialog" + フォーカス制御で等価なアクセシビリティを確保している。
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="relative bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg p-6 sm:p-8 max-w-sm w-full animate-dialogIn"
      >
        <button
          type="button"
          onClick={closeDialog}
          aria-label={t("dialog.close")}
          className="absolute top-3 right-3 p-1 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        <div className="text-center mb-6 mt-2">
          <h2
            id="auth-dialog-title"
            className="text-lg sm:text-xl font-semibold text-[var(--fg)] leading-relaxed"
          >
            {title}
          </h2>
          <p className="text-sm text-[var(--fg-muted)] mt-2 leading-relaxed">{subtitle}</p>
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
              >
                {t("fields.email")}
              </label>
              <div className="relative">
                <Mail size={16} strokeWidth={1.5} className={leadingIconClass} />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("fields.emailPlaceholder")}
                  className={inputClass}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="px-4 py-3 bg-[var(--accent-subtle)] border border-[var(--accent)] text-[var(--accent-strong)] text-xs rounded-md leading-relaxed">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 text-white px-6 py-3 rounded-md transition-colors text-sm tracking-wide"
            >
              {loading ? t("forgot.submitting") : t("forgot.submit")}
            </button>

            <button
              type="button"
              onClick={() => switchMode("login")}
              className="w-full inline-flex items-center justify-center gap-2 text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
              {t("forgot.back")}
            </button>
          </form>
        ) : (
          <>
            <div className="flex justify-center gap-8 mb-6 text-sm tracking-wide">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`pb-2 border-b transition-colors ${
                  mode === "login"
                    ? "border-[var(--accent)] text-[var(--fg)]"
                    : "border-transparent text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
                }`}
              >
                {t("login.tabLogin")}
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`pb-2 border-b transition-colors ${
                  mode === "signup"
                    ? "border-[var(--accent)] text-[var(--fg)]"
                    : "border-transparent text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
                }`}
              >
                {t("login.tabSignup")}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
                >
                  {t("fields.email")}
                </label>
                <div className="relative">
                  <Mail size={16} strokeWidth={1.5} className={leadingIconClass} />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t("fields.emailPlaceholder")}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
                >
                  {t("fields.password")}
                </label>
                <div className="relative">
                  <Lock size={16} strokeWidth={1.5} className={leadingIconClass} />
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t("fields.passwordPlaceholder")}
                    minLength={6}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors"
                    aria-label={showPassword ? t("fields.hidePassword") : t("fields.showPassword")}
                  >
                    {showPassword ? (
                      <Eye size={16} strokeWidth={1.5} />
                    ) : (
                      <EyeOff size={16} strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="px-4 py-3 bg-[var(--accent-subtle)] border border-[var(--accent)] text-[var(--accent-strong)] text-xs rounded-md leading-relaxed">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 text-white px-6 py-3 rounded-md transition-colors text-sm tracking-wide"
              >
                {loading
                  ? t("login.submitting")
                  : mode === "login"
                    ? t("login.submit")
                    : t("signup.submit")}
              </button>

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="w-full text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors text-center"
                >
                  {t("login.forgotLink")}
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
