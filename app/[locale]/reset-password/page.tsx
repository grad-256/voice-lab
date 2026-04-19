"use client";

export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

// 入力フィールド共通クラス（Quiet Journal 仕様）
// 左側にアイコン用の余白（pl-10）、右側はパスワード切替アイコン用に pr-10
const inputClass =
  "w-full pl-10 pr-10 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] rounded-md focus:border-[var(--accent)] focus:outline-none transition-colors";

const leadingIconClass =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirm) {
      setErrorMsg(t("errors.mismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/login");
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

  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-xl sm:text-2xl font-semibold text-[var(--fg)] leading-relaxed">
            {t("title")}
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-3 leading-relaxed">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="password"
              className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
            >
              {t("newPassword")}
            </label>
            <div className="relative">
              <Lock size={16} strokeWidth={1.5} className={leadingIconClass} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t("placeholderNew")}
                minLength={6}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? (
                  <Eye size={16} strokeWidth={1.5} />
                ) : (
                  <EyeOff size={16} strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-xs text-[var(--fg-muted)] mb-2 tracking-wide"
            >
              {t("confirmPassword")}
            </label>
            <div className="relative">
              <Lock size={16} strokeWidth={1.5} className={leadingIconClass} />
              <input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder={t("placeholderConfirm")}
                minLength={6}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors"
                aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
              >
                {showConfirm ? (
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 text-white px-6 py-3 rounded-md transition-colors text-sm tracking-wide"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
