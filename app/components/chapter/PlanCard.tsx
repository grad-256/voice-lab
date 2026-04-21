"use client";

// Pricing ページ用の 1 プランカード。
// Chapter 系譜のリズムに沿い、Cap（プラン名）+ Fraunces の価格 + 機能 list + CTA の構成。
// highlighted=true のとき、枠線を濃く・Cap を反転させて "人気プラン" を静かに強調する。
// CTA は本 PR では Stripe 未接続のため `onSelect` コールバックだけ受ける（ページ側で console.warn）。

import { MONO_FAMILY, SANS_FAMILY, SERIF_FAMILY } from "@/lib/typography";
import type { CSSProperties, ReactNode } from "react";

type PlanCardProps = {
  name: string;
  /** サブ表記（日本語のプラン名 "しずけさ" 等）。空文字のときは表示しない。 */
  price: string;
  period: string;
  tagline: string;
  features: readonly string[];
  ctaLabel: string;
  /** "人気" 等のバッジ。undefined のときは表示しない。 */
  badge?: string;
  /** 視覚的に 1 段強調する（枠線を濃く・Cap を反転） */
  highlighted?: boolean;
  /** CTA 下に表示する補助ノート（stripePendingNote 等） */
  footnote?: ReactNode;
  onSelect: () => void;
};

export function PlanCard({
  name,
  price,
  period,
  tagline,
  features,
  ctaLabel,
  badge,
  highlighted = false,
  footnote,
  onSelect,
}: PlanCardProps) {
  const cardStyle: CSSProperties = {
    border: highlighted ? "1px solid var(--fg)" : "0.5px solid var(--border)",
    padding: "22px 20px 20px",
    position: "relative",
    background: "transparent",
  };

  const capStyle: CSSProperties = {
    textTransform: "uppercase",
    display: "inline-block",
    padding: highlighted ? "3px 8px" : "0",
    background: highlighted ? "var(--fg)" : "transparent",
    color: highlighted ? "var(--bg)" : "var(--fg-muted)",
    marginBottom: 10,
  };

  const ctaStyle: CSSProperties = {
    padding: "13px 20px",
    fontWeight: 600,
    textTransform: "uppercase",
    width: "100%",
    cursor: "pointer",
    background: highlighted ? "var(--fg)" : "transparent",
    color: highlighted ? "var(--bg)" : "var(--fg)",
    border: highlighted ? "none" : "0.5px solid var(--fg)",
    fontFamily: SANS_FAMILY,
    marginTop: 18,
  };

  return (
    <article style={cardStyle}>
      <div className="text-xs sm:text-sm tracking-[0.4em]" style={capStyle}>
        {name}
      </div>

      {badge && (
        <div
          className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[var(--fg-muted)]"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            fontFamily: MONO_FAMILY,
          }}
        >
          {badge}
        </div>
      )}

      {/* 価格 + 期間（serif italic period） */}
      <div className="flex items-baseline gap-2 mt-1">
        <span
          className="text-4xl sm:text-5xl tracking-tight"
          style={{
            fontFamily: SERIF_FAMILY,
            fontWeight: 400,
            color: "var(--fg)",
          }}
        >
          {price}
        </span>
        <span
          className="text-xs sm:text-sm tracking-wider text-[var(--fg-muted)]"
          style={{ fontFamily: MONO_FAMILY }}
        >
          {period}
        </span>
      </div>

      <p className="text-xs sm:text-sm text-[var(--fg-muted)] leading-relaxed mt-3">{tagline}</p>

      {/* 機能リスト：中黒 · で仕切る */}
      <ul className="mt-4 space-y-[6px]">
        {features.map((feature) => (
          <li
            key={feature}
            className="text-xs sm:text-sm text-[var(--fg)] leading-[1.55] flex gap-[10px]"
          >
            <span aria-hidden className="text-[var(--fg-muted)] select-none">
              ·
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onSelect} className="text-xs sm:text-sm" style={ctaStyle}>
        {ctaLabel}
      </button>

      {footnote && (
        <div className="text-xs sm:text-sm text-[var(--fg-muted)] text-center mt-2 leading-[1.5]">
          {footnote}
        </div>
      )}
    </article>
  );
}
