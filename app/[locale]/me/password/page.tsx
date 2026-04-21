"use client";

// 静的プリレンダリングを無効化（Supabase クライアント・router を使うため）
export const dynamic = "force-dynamic";
export const runtime = "edge";

import {
  BottomTab,
  Cap,
  ConfirmDialog,
  PageHeader,
  Rule,
  UnderlineField,
} from "@/app/components/chapter";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";
import { type CSSProperties, useEffect, useRef, useState } from "react";

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';

const MIN_PASSWORD_LENGTH = 6;

/**
 * `/me/password` — ログイン中のユーザーがマイページからパスワードを変更する画面。
 *
 * リセットリンク経由の `/reset-password` とは異なり、現在のセッションを保持したまま
 * `supabase.auth.updateUser({ password })` で新しいパスワードを設定する。
 * 成功すると `/me` に戻る。未ログイン時は `/app` に退避し AuthGate がダイアログを開く。
 */
export default function SettingsPasswordPage() {
  const t = useTranslations("me.password");
  // 確認モーダルの Cap "Confirm · 確認" は /me と /me/password で共用するため
  // 親 namespace `me.chapter.confirmCap` を参照する（重複定義を避ける）。
  const tMe = useTranslations("me");
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const canSubmit =
    !loading && !showToast && password.length >= MIN_PASSWORD_LENGTH && password === confirm;

  // 成功トーストを少し見せてから設定画面へ戻すためのタイマー
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 未ログインユーザーの退避は AuthGate（AuthContext の user 監視）が担当。
  // ページ側で重複チェックはしない。

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // フォーム送信：バリデーション後に確認モーダルを開く（updateUser はモーダル CTA で）
  // React 19 の FormEvent 型は deprecated 扱いになるため、preventDefault は呼び出し側で
  // 行い、本関数はイベントを受け取らない設計にする。
  const validateAndOpenConfirm = () => {
    setErrorMsg(null);
    if (password !== confirm) {
      setErrorMsg(t("errors.mismatch"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
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

  const backLink: CSSProperties = { color: "inherit", textDecoration: "none" };

  // Cancel Ghost / Save Primary（章末のボタンペア）
  const baseBtn: CSSProperties = {
    padding: "13px 20px",
    textTransform: "uppercase",
    cursor: "pointer",
    flex: 1,
  };
  const ghostStyle: CSSProperties = {
    ...baseBtn,
    fontWeight: 500,
    background: "transparent",
    color: "var(--fg)",
    border: "0.5px solid var(--fg)",
  };
  const primaryStyle: CSSProperties = {
    ...baseBtn,
    fontWeight: 600,
    background: "var(--fg)",
    color: "var(--bg)",
    border: "none",
    opacity: canSubmit ? 1 : 0.4,
  };

  return (
    <main className="flex-1 w-full max-w-md mx-auto flex flex-col px-7 pt-14 pb-24 animate-fadeIn">
      <PageHeader
        left={
          <Link href="/me" style={backLink} className="hover:text-[var(--fg)] transition-colors">
            ← Me
          </Link>
        }
      />

      {/* 章題：Cap + Fraunces 章題 */}
      <div className="mt-6">
        <Cap mb={8}>{t("chapter.cap")}</Cap>
        <div
          className="text-3xl sm:text-4xl leading-tight tracking-tight"
          style={{
            fontFamily: SERIF_FAMILY,
            fontWeight: 400,
          }}
        >
          {t("chapter.titleLead")}
          <br />
          <span style={{ fontStyle: "italic" }}>{t("chapter.titleItalic")}</span>
          {t("chapter.titleTail")}
        </div>
      </div>

      <Rule mv={16} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          validateAndOpenConfirm();
        }}
        className="flex-1 flex flex-col"
      >
        <div>
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
        </div>

        {/* Supabase は updateUser でパスワードを更新すると、現在のセッション以外の
            リフレッシュトークンを失効させる。他端末からは再ログインが必要になる旨を
            送信前に明示する（デザインソース b-section の "We'll sign you out..." 相当）。 */}
        <div className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.6] mt-4">
          {t("signOutNotice")}
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 px-3 py-2 text-[var(--error)] text-xs sm:text-sm"
            style={{ border: "0.5px solid var(--error)" }}
          >
            {errorMsg}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => router.push("/me")}
            disabled={loading}
            className="text-xs sm:text-sm tracking-widest"
            style={ghostStyle}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="text-xs sm:text-sm tracking-widest"
            style={primaryStyle}
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </div>

        {/* 成功トースト：スクリーンリーダー向けに aria-live を付与 */}
        <output
          aria-live="polite"
          className={`block text-center text-xs sm:text-sm uppercase tracking-[0.2em] text-[var(--fg-muted)] mt-4 transition-opacity ${
            showToast ? "opacity-100" : "opacity-0"
          }`}
        >
          {showToast ? t("successToast") : ""}
        </output>
      </form>

      {/* 変更前の最終確認モーダル */}
      {showConfirmModal && (
        <ConfirmDialog
          titleId="password-confirm-title"
          cap={tMe("chapter.confirmCap")}
          title={t("confirmModal.title")}
          desc={t("confirmModal.desc")}
          errorMsg={null}
          cancelLabel={t("confirmModal.cancel")}
          confirmLabel={loading ? t("submitting") : t("confirmModal.confirm")}
          isProcessing={loading}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={executePasswordUpdate}
        />
      )}

      <BottomTab />
    </main>
  );
}
