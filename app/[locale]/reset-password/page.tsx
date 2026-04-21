"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Cap, PageHeader, Rule, UnderlineField } from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { MONO_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import { useTranslations } from "next-intl";
import { type CSSProperties, useState } from "react";

const MIN_PASSWORD_LENGTH = 6;

/**
 * `/reset-password` — Supabase recovery トークンで PKCE セッションを得たユーザーが
 * 新しいパスワードを設定する画面。`updateUser` が成功するとハブ（/app）へ遷移する。
 *
 * Chapter 系譜：中央寄せ Cap + Fraunces 章題 + 下罫線フォーム。
 */
export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = !loading && password.length >= MIN_PASSWORD_LENGTH && password === confirm;

  // React 19 の FormEvent 型は deprecated 扱いになるため、preventDefault は呼び出し側で
  // 行い、本関数はイベントを受け取らない設計にする。
  const submitNewPassword = async () => {
    setErrorMsg(null);

    if (password !== confirm) {
      setErrorMsg(t("errors.mismatch"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(t("errors.tooShort"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Supabase はリカバリトークンで既にログイン済セッションを発行しているので
      // ログイン画面へは戻さず、ハブ（/app）へ直接遷移する。
      router.push("/app");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Auth session missing")) {
        setErrorMsg(t("errors.sessionMissing"));
      } else if (msg.includes("Password should be at least")) {
        setErrorMsg(t("errors.tooShort"));
      } else {
        setErrorMsg(t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Save Primary（big + full）
  const primaryStyle: CSSProperties = {
    width: "100%",
    padding: "16px 22px",
    fontWeight: 600,
    textTransform: "uppercase",
    background: "var(--fg)",
    color: "var(--bg)",
    border: "none",
    cursor: canSubmit ? "pointer" : "default",
    opacity: canSubmit ? 1 : 0.4,
  };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-8 animate-fadeIn">
      <PageHeader />

      <div className="flex-1 flex flex-col justify-center">
        <Cap mb={10}>{t("chapter.cap")}</Cap>
        <div
          className="text-4xl sm:text-5xl tracking-tight"
          style={{
            fontFamily: SERIF_FAMILY,
            fontWeight: 400,
          }}
        >
          {t("chapter.titleLead")}
          <br />
          <span>{t("chapter.titleAccent")}</span>
          {t("chapter.titleTail")}
        </div>
        <p className="text-xs sm:text-sm text-[var(--fg-muted)] mt-3 max-w-[280px] leading-[1.55]">
          {t("description")}
        </p>

        <Rule mv={20} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitNewPassword();
          }}
        >
          <UnderlineField
            id="password"
            label={t("newPassword")}
            value={password}
            onChange={setPassword}
            placeholder={t("placeholderNew")}
            autoComplete="new-password"
            isVisible={showPassword}
            onToggleVisibility={() => setShowPassword((v) => !v)}
            sub={t("hintMinLength", { min: MIN_PASSWORD_LENGTH })}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            minLength={MIN_PASSWORD_LENGTH}
          />
          <UnderlineField
            id="confirm"
            label={t("confirmPassword")}
            value={confirm}
            onChange={setConfirm}
            placeholder={t("placeholderConfirm")}
            autoComplete="new-password"
            isVisible={showConfirm}
            onToggleVisibility={() => setShowConfirm((v) => !v)}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            minLength={MIN_PASSWORD_LENGTH}
          />

          {errorMsg && (
            <div
              role="alert"
              className="mt-4 px-3 py-2 text-[var(--error)] text-xs sm:text-sm"
              style={{ border: "0.5px solid var(--error)" }}
            >
              {errorMsg}
            </div>
          )}

          <div className="mt-7">
            <button
              type="submit"
              disabled={!canSubmit}
              className="text-sm sm:text-base tracking-widest"
              style={primaryStyle}
            >
              {loading ? t("submitting") : `${t("submit")} →`}
            </button>
          </div>

          {/* リンクの有効期限切れ等で行き詰まったら、ホーム経由で再度ログインできるよう導線を残す */}
          <div
            className="text-center mt-3 text-xs sm:text-sm text-[var(--fg-muted)] tracking-[0.16em] uppercase"
            style={{ fontFamily: MONO_FAMILY }}
          >
            <span>{t("rememberItPrefix")} </span>
            <Link
              href="/"
              className="text-[var(--fg)] hover:opacity-80 transition-opacity"
              style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {t("signInLink")}
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
