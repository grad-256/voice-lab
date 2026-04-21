"use client";

// Chapter 系譜のボタン 2 種。
// - Primary：ink 地に bg 色の文字（accent フラグで accent 地に）
// - Ghost：透明背景に 0.5px のインク罫線
// いずれも uppercase + 0.14em tracking で "活字のスタンプ" 感を出す。
//
// 外部リンク（Notion 法務ページ等）は next-intl の Link を使うとロケールプリフィックスが
// 付いてしまうため、external=true のとき素の <a target="_blank"> に分岐する。

import { Link } from "@/i18n/routing";
import { SANS_FAMILY } from "@/lib/typography";
import type { CSSProperties, ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  big?: boolean;
  full?: boolean;
  /** 内部パス（例：/pricing）or 外部 URL（external=true のとき）。指定なしならボタン扱い。 */
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** 外部 URL のとき true。素の <a target="_blank"> でレンダリングされる。 */
  external?: boolean;
};

type PrimaryProps = BaseProps & {
  /** accent カラー（墨青 / 深藍）を地色にするか。既定は ink 地 */
  accent?: boolean;
};

function buildSharedStyle(full: boolean, big: boolean): CSSProperties {
  return {
    padding: big ? "16px 22px" : "13px 20px",
    fontSize: big ? 12 : 11,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    width: full ? "100%" : undefined,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontFamily: SANS_FAMILY,
    border: "none",
  };
}

export function BtnPrimary({
  children,
  big = false,
  full = false,
  accent = false,
  href,
  onClick,
  type = "button",
  disabled,
  external,
}: PrimaryProps) {
  const style: CSSProperties = {
    ...buildSharedStyle(full, big),
    fontWeight: 600,
    background: accent ? "var(--accent)" : "var(--fg)",
    color: accent ? "#fff" : "var(--bg)",
    opacity: disabled ? 0.4 : 1,
  };

  if (href && external) {
    return (
      <a href={href} style={style} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

export function BtnGhost({
  children,
  big = false,
  full = false,
  href,
  onClick,
  type = "button",
  disabled,
  external,
}: BaseProps) {
  const style: CSSProperties = {
    ...buildSharedStyle(full, big),
    background: "transparent",
    color: "var(--fg)",
    border: "0.5px solid var(--fg)",
    opacity: disabled ? 0.4 : 1,
  };

  if (href && external) {
    return (
      <a href={href} style={style} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}
