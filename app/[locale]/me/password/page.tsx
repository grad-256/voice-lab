"use client";

// 静的プリレンダリングを無効化（Supabase クライアント・router を使うため）
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

// 入力フィールド共通クラス（reset-password と統一）
const inputClass =
  "w-full pl-10 pr-10 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] rounded-md focus:border-[var(--accent)] focus:outline-none transition-colors";

const leadingIconClass =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]";

/**
 * `/me/password` — ログイン中のユーザーがマイページからパスワードを変更する画面。
 *
 * リセットリンク経由の `/reset-password` とは異なり、現在のセッションを保持したまま
 * `supabase.auth.updateUser({ password })` で新しいパスワードを設定する。
 * 成功すると `/me` に戻る。未ログイン時は `/app` に退避し AuthGate がダイアログを開く。
 */
export default function SettingsPasswordPage() {
  const t = useTranslations("me.password");
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  // 破壊的操作前の確認モーダル
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 誤送信防止：未入力・短すぎ・不一致の間は送信不可（送信中・成功後も同様）
  const canSubmit = !loading && !showToast && password.length >= 6 && password === confirm;

  // 成功トーストを少し見せてから設定画面へ戻すためのタイマー
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 未ログインユーザーは設定変更不可。AuthGate が /app へ退避するが、
  // 保護ページ直アクセス時の API 叩き開始を防ぐため、ここでも /app へ退避する。
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (!data.user) router.push("/app");
    });
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // フォーム送信：バリデーション後に確認モーダルを開く（updateUser はモーダル CTA で）
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirm) {
      setErrorMsg(t("errors.mismatch"));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t("errors.tooShort"));
      return;
    }
    setShowConfirmModal(true);
  };

  // 確認モーダルの「変更する」CTA で実行する本処理
  const executePasswordUpdate = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setShowConfirmModal(false);
      setShowToast(true);
      // トーストを少し見せてから設定画面に戻る
      redirectTimerRef.current = setTimeout(() => {
        router.push("/me");
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Password should be at least")) {
        setErrorMsg(t("errors.tooShort"));
      } else {
        setErrorMsg(t("errors.generic"));
      }
      setShowConfirmModal(false);
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 pt-10 pb-16 sm:pt-12 sm:pb-20 animate-fadeIn">
      <div className="w-full max-w-sm">
        {/* 極薄ヘッダー：戻るリンクのみ */}
        <header className="mb-10">
          <Link
            href="/me"
            className="inline-flex items-center gap-2 text-sm tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            {t("back")}
          </Link>
        </header>

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
                autoComplete="new-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={1.5} />
                ) : (
                  <Eye size={16} strokeWidth={1.5} />
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
                autoComplete="new-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors"
                aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
              >
                {showConfirm ? (
                  <EyeOff size={16} strokeWidth={1.5} />
                ) : (
                  <Eye size={16} strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] text-xs rounded-md"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md transition-colors text-sm tracking-wide"
          >
            {loading ? t("submitting") : t("submit")}
          </button>

          {/* 成功トースト：スクリーンリーダー向けに aria-live を付与 */}
          <output
            aria-live="polite"
            className={`block text-center text-xs text-[var(--fg-muted)] transition-opacity ${
              showToast ? "opacity-100" : "opacity-0"
            }`}
          >
            {showToast ? t("successToast") : ""}
          </output>
        </form>
      </div>

      {/* 変更前の最終確認モーダル */}
      {showConfirmModal && (
        <dialog
          open
          aria-labelledby="password-confirm-title"
          className="fixed inset-0 z-50 m-0 max-w-none max-h-none w-screen h-screen p-4 border-0 bg-[var(--bg-overlay)] flex items-center justify-center animate-fadeIn"
        >
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full">
            <h2 id="password-confirm-title" className="text-lg font-semibold text-[var(--fg)] mb-2">
              {t("confirmModal.title")}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] mb-6 leading-relaxed">
              {t("confirmModal.desc")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] px-4 py-2.5 rounded-md text-sm transition-colors disabled:opacity-50"
              >
                {t("confirmModal.cancel")}
              </button>
              <button
                type="button"
                onClick={executePasswordUpdate}
                disabled={loading}
                className="bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-50 text-white px-4 py-2.5 rounded-md text-sm transition-colors"
              >
                {loading ? t("submitting") : t("confirmModal.confirm")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}
