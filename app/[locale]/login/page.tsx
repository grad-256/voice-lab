"use client";

// 静的プリレンダリングを無効化（Supabase クライアントはビルド時に初期化できないため）
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// 入力フィールド共通クラス（Quiet Journal 仕様）
// 左側にアイコン用の余白（pl-10）、右側は基本 pr-4。パスワードのみ pr-10 で上書きする。
const inputClass =
  "w-full pl-10 pr-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] rounded-md focus:border-[var(--accent)] focus:outline-none transition-colors";

// 入力左端のアイコン共通クラス（Mail / Lock）
const leadingIconClass =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]";

// ────────────────────────────────────────────────
// ログイン / サインアップ / パスワードリセット 画面
// ────────────────────────────────────────────────
function LoginPageInner() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showGuestDialog, setShowGuestDialog] = useState(false);

  const switchMode = (next: "login" | "signup" | "forgot") => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/app");
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Confirm email オフの場合はセッションが即発行されるのでリダイレクト
        if (data.session) {
          router.push("/app");
          router.refresh();
        } else {
          setSuccessMsg(t("signup.confirmEmailSent"));
        }
      } else {
        // パスワードリセットメール送信
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

  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      <div className="w-full max-w-sm">
        {/* タイトル（ロゴは廃し、静かなセリフ見出しだけ） */}
        <div className="text-center mb-10">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--fg)] leading-relaxed">
            {mode === "forgot"
              ? t("forgot.title")
              : mode === "signup"
                ? t("signup.title")
                : t("login.title")}
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-3 leading-relaxed">
            {mode === "forgot" ? t("forgot.subtitle") : t("login.subtitle")}
          </p>
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
              >
                {t("fields.email")}
              </label>
              <div className="relative">
                <Mail size={16} strokeWidth={1.5} className={leadingIconClass} />
                <input
                  id="email"
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
            {/* モード切替：タブではなく、下線のリンク風 */}
            <div className="flex justify-center gap-8 mb-8 text-sm tracking-wide">
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
                  htmlFor="email"
                  className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
                >
                  {t("fields.email")}
                </label>
                <div className="relative">
                  <Mail size={16} strokeWidth={1.5} className={leadingIconClass} />
                  <input
                    id="email"
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
                  htmlFor="password"
                  className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
                >
                  {t("fields.password")}
                </label>
                <div className="relative">
                  <Lock size={16} strokeWidth={1.5} className={leadingIconClass} />
                  <input
                    id="password"
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

              {/* 区切り線と「または」 */}
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--fg-subtle)] tracking-wide">
                  {t("guestDialog.orSeparator")}
                </span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              <button
                type="button"
                onClick={() => setShowGuestDialog(true)}
                className="block w-full text-center py-2 text-sm tracking-wide text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              >
                {t("guestDialog.trigger")}
              </button>
            </form>
          </>
        )}
      </div>

      {/* ゲスト体験ダイアログ */}
      {showGuestDialog && (
        <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg p-6 max-w-sm w-full space-y-5">
            <h2 className="text-lg font-medium text-[var(--fg)]">{t("guestDialog.title")}</h2>
            <ul className="text-sm text-[var(--fg-muted)] space-y-2 leading-relaxed">
              <li>・{t("guestDialog.item1")}</li>
              <li>・{t("guestDialog.item2")}</li>
              <li>・{t("guestDialog.item3")}</li>
            </ul>
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/app"
                className="w-full py-3 text-center rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm tracking-wide transition-colors"
              >
                {t("guestDialog.confirm")}
              </Link>
              <button
                type="button"
                onClick={() => setShowGuestDialog(false)}
                className="w-full text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
              >
                {t("guestDialog.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
