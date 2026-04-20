"use client";

// iOS Safari 向け「ホーム画面に追加」手順案内モーダル。
// iOS は `beforeinstallprompt` を発火させないため、共有ボタン → 「ホーム画面に追加」の
// 手順をテキストと SVG アイコンで段階的に示す。
//
// デザイン方針：
// - AuthDialog と同じ overlay + dialog の構造で一貫性を保つ
// - 実写スクショは端末撮影が必要なため初版はインライン SVG のみ（v2 で差し替え）
// - モーダル内に「今は閉じる」「もう表示しない」の 2 フッタアクションを置く

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onDismissPermanently: () => void;
};

// iOS Safari の共有ボタンアイコン（アップロードアイコン風、四角 + 上向き矢印）。
// iOS 純正のアイコンに近い形状で直感的に「あれのことか」と認識できる粒度に留める。
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 4v12" />
      <path d="M8 8l4-4 4 4" />
      <path d="M6 14v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5" />
    </svg>
  );
}

// 「ホーム画面に追加」メニュー項目で表示されるプラス記号アイコン。
function PlusBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function IOSInstallGuideModal({ isOpen, onClose, onDismissPermanently }: Props) {
  const t = useTranslations("lp.iosInstallGuide");

  // 背景スクロールロック（AuthDialog と同等の対応）
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Esc で閉じる
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--bg-overlay)] cursor-default animate-overlayIn"
      />
      <div
        // biome-ignore lint/a11y/useSemanticElements: React state 駆動で open/close を管理するため native <dialog> と相性が悪い。aria-modal で等価対応。
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-guide-title"
        className="relative bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg p-6 sm:p-7 max-w-sm w-full animate-dialogIn"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute top-3 right-3 p-1 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        <div className="text-center mb-6 mt-2">
          <h2
            id="ios-install-guide-title"
            className="text-lg sm:text-xl font-semibold text-[var(--fg)] leading-relaxed"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-[var(--fg-muted)] mt-2 leading-relaxed">{t("subtitle")}</p>
        </div>

        <ol className="space-y-4">
          <li className="flex items-start gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-sm font-semibold flex items-center justify-center">
              1
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--fg)] leading-relaxed">{t("step1.body")}</p>
            </div>
            <ShareIcon className="flex-shrink-0 w-6 h-6 text-[var(--accent)] mt-0.5" />
          </li>
          <li className="flex items-start gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-sm font-semibold flex items-center justify-center">
              2
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--fg)] leading-relaxed">{t("step2.body")}</p>
            </div>
            <PlusBoxIcon className="flex-shrink-0 w-6 h-6 text-[var(--accent)] mt-0.5" />
          </li>
        </ol>

        <p className="text-xs text-[var(--fg-subtle)] mt-4 leading-relaxed">{t("note")}</p>

        <div className="mt-6 flex flex-col sm:flex-row-reverse gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-sm font-medium rounded-md transition-colors"
          >
            {t("closeNow")}
          </button>
          <button
            type="button"
            onClick={onDismissPermanently}
            className="flex-1 px-4 py-2.5 text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
          >
            {t("dontShowAgain")}
          </button>
        </div>
      </div>
    </div>
  );
}
