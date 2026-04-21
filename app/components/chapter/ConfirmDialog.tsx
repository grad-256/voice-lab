"use client";

// Chapter 系譜の確認ダイアログ。bg-elevated に 0.5px 細罫、フッタは Ghost + Primary。
// 共通用途：ログアウト確認・アカウント削除確認・パスワード変更確認 など。
// 章題は短い Cap + Fraunces 章題のリズムで、本文は 12px muted の落ち着いたトーン。
// 削除など破壊的操作も grayscale + 1 accent のルールに従い、CTA は黒で統一する
// （色で破壊性を示さず、章題と本文文言で危険度を伝える流儀）。

import type { CSSProperties } from "react";
import { Cap } from "./Cap";

const SERIF_FAMILY = 'var(--font-serif), "Noto Serif JP", serif';

type ConfirmDialogProps = {
  /** aria-labelledby 用の id（呼び出し側でユニークに） */
  titleId: string;
  /** 上部の小見出し（uppercase）。例：Confirm / 確認 */
  cap: string;
  /** 章題本体 */
  title: string;
  /** 説明文 */
  desc: string;
  /** 表示するエラーメッセージ。null なら非表示 */
  errorMsg?: string | null;
  cancelLabel: string;
  confirmLabel: string;
  /** 通信中など、ボタンを無効化する */
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  titleId,
  cap,
  title,
  desc,
  errorMsg,
  cancelLabel,
  confirmLabel,
  isProcessing,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const baseBtn: CSSProperties = {
    padding: "13px 20px",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
    flex: 1,
  };
  const ctaStyle: CSSProperties = {
    ...baseBtn,
    fontWeight: 600,
    background: "var(--fg)",
    color: "var(--bg)",
    border: "none",
    opacity: isProcessing ? 0.5 : 1,
  };
  const ghostStyle: CSSProperties = {
    ...baseBtn,
    fontWeight: 500,
    background: "transparent",
    color: "var(--fg)",
    border: "0.5px solid var(--fg)",
    opacity: isProcessing ? 0.5 : 1,
  };

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 m-0 max-w-none max-h-none w-screen h-screen p-0 border-0 bg-[var(--bg-overlay)] flex items-center justify-center px-6 animate-fadeIn"
    >
      <div
        className="w-full max-w-sm bg-[var(--bg-elevated)] p-7"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <Cap mb={10}>{cap}</Cap>
        <h2
          id={titleId}
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        <p className="mt-3 text-[12px] text-[var(--fg-muted)] leading-[1.6]">{desc}</p>
        {errorMsg && (
          <div
            role="alert"
            className="mt-4 px-3 py-2 text-[var(--error)] text-[11px]"
            style={{ border: "0.5px solid var(--error)" }}
          >
            {errorMsg}
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} disabled={isProcessing} style={ghostStyle}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isProcessing} style={ctaStyle}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
