"use client";

// FAQ の 1 件。番号（MONO）+ 質問（sans）+ 開閉トグル + 本文の構成。
// 開閉状態は親から制御する（同時に 1 件だけ開く等の挙動を親で選べるようにするため）。
// 本文は details/summary 相当の表現だが、カスタムアニメーション（高さ展開）と A11y を両立するため
// button + aria-expanded + 条件レンダリングで組む。

import type { ReactNode } from "react";

const MONO_FAMILY = "var(--font-mono), ui-monospace, monospace";

type FaqItemProps = {
  /** "01" 等の 2 桁番号文字列 */
  number: string;
  question: string;
  answer: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  /** 開くボタンの aria-label 用（JA: "開く" / EN: "Open"） */
  expandLabel: string;
  /** 閉じるボタンの aria-label 用（JA: "閉じる" / EN: "Close"） */
  collapseLabel: string;
  /** 最後の要素か（下罫線を消す） */
  last?: boolean;
};

export function FaqItem({
  number,
  question,
  answer,
  isOpen,
  onToggle,
  expandLabel,
  collapseLabel,
  last = false,
}: FaqItemProps) {
  const panelId = `faq-panel-${number}`;
  const buttonId = `faq-button-${number}`;

  return (
    <div
      style={{
        borderBottom: last ? "none" : "0.5px solid var(--border)",
        padding: "16px 0",
      }}
    >
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? collapseLabel : expandLabel}
        className="block w-full text-left bg-transparent border-0 p-0 text-inherit cursor-pointer"
      >
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start">
          <span
            aria-hidden
            className="text-xs sm:text-sm text-[var(--fg-muted)]"
            style={{
              fontFamily: MONO_FAMILY,
              letterSpacing: "0.2em",
              paddingTop: 3,
            }}
          >
            {number}
          </span>
          <span className="text-sm sm:text-base text-[var(--fg)] font-medium tracking-[-0.005em] leading-[1.55]">
            {question}
          </span>
          <span
            aria-hidden
            className="text-sm sm:text-base text-[var(--fg-muted)] select-none"
            style={{ paddingTop: 3, transition: "transform 160ms ease" }}
          >
            {isOpen ? "−" : "+"}
          </span>
        </div>
      </button>

      {isOpen && (
        <section
          id={panelId}
          aria-labelledby={buttonId}
          className="grid grid-cols-[auto_1fr_auto] gap-4 mt-3"
        >
          {/* 番号桁と + アイコンの桁を空の span で埋め、本文を question と同じカラムに揃える */}
          <span aria-hidden />
          <div className="text-xs sm:text-sm text-[var(--fg-muted)] leading-[1.75]">{answer}</div>
          <span aria-hidden />
        </section>
      )}
    </div>
  );
}
