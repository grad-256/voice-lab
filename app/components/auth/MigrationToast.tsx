"use client";

import { useEffect } from "react";

/**
 * ゲスト → 認証ユーザー移行成功時に表示する軽量トースト。
 *
 * - role="status" + aria-live="polite" でスクリーンリーダーに通知
 * - 自動ディスミス 5 秒（コンポーネント側で setTimeout）
 * - × ボタンで手動クローズも可能
 *
 * 親（AuthMigrationListener）が表示の有無を制御する設計。
 */

export interface MigrationToastProps {
  message: string;
  onDismiss: () => void;
  /** 自動ディスミスまでの時間（ms）。既定 5000 */
  autoDismissMs?: number;
}

const DEFAULT_AUTO_DISMISS_MS = 5000;

export function MigrationToast({
  message,
  onDismiss,
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
}: MigrationToastProps) {
  // 自動ディスミス。コンポーネントは「移行成功時に親が key を変えて再マウント」する想定なので
  // message の変化検知は親側に委ねる（このタイマーは初回マウント時だけ発火すれば十分）
  useEffect(() => {
    const timerId = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timerId);
  }, [onDismiss, autoDismissMs]);

  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 block -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-700/70 bg-emerald-950/90 px-4 py-3 text-sm text-emerald-50 shadow-lg shadow-emerald-900/40 backdrop-blur">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-emerald-300"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.296a1 1 0 0 1 0 1.408l-7.5 7.5a1 1 0 0 1-1.408 0l-3.5-3.5a1 1 0 1 1 1.408-1.408l2.796 2.796 6.796-6.796a1 1 0 0 1 1.408 0Z"
            clipRule="evenodd"
          />
        </svg>
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="通知を閉じる"
          className="ml-1 rounded-full p-1 text-emerald-200/70 transition-colors hover:bg-emerald-900/60 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </output>
  );
}
