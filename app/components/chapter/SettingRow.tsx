"use client";

// Chapter 系譜の設定行。label + sub + 右端 value の 1 行。
// 下罫線で区切り、連続するリストで "書物の目次" のようなリズムを作る。

import { Link } from "@/i18n/routing";
import type { CSSProperties, ReactNode } from "react";

type SettingRowProps = {
  label: ReactNode;
  /** 英語での副説明 */
  sub?: ReactNode;
  /** 日本語での副説明（sub とは別に和文だけで出したいとき） */
  jp?: ReactNode;
  /** 右端の値（"→" や "¥980" 等）。モノスペースで出す */
  value?: ReactNode;
  /** リスト末尾で下罫線を消したいとき */
  last?: boolean;
  /** 行自体をリンクにしたい場合 */
  href?: string;
  /** 行自体をボタンにしたい場合 */
  onClick?: () => void;
};

export function SettingRow({
  label,
  sub,
  jp,
  value,
  last = false,
  href,
  onClick,
}: SettingRowProps) {
  const rowStyle: CSSProperties = {
    borderBottom: last ? "none" : "0.5px solid var(--border)",
  };

  // Tailwind 標準スケールに乗せて、狭い画面では従来の見た目、sm:/md: 以上で 1〜2 段大きくする。
  // label 13 → 14 → 16、sub 10.5 → 12 → 14、value 11 → 12 → 14、jp 10 → 11 → 12
  const content = (
    <div className="grid grid-cols-[1fr_auto] gap-3 py-[14px]" style={rowStyle}>
      <div>
        <div className="text-sm sm:text-base font-medium tracking-[-0.005em] text-[var(--fg)]">
          {label}
        </div>
        {sub != null && (
          <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[2px]">{sub}</div>
        )}
        {jp != null && (
          <div className="text-xs sm:text-sm text-[var(--fg-muted)] mt-[1px]">{jp}</div>
        )}
      </div>
      {value !== undefined && (
        <div className="font-mono-jp text-xs sm:text-sm text-[var(--fg-muted)] self-center tracking-[0.02em]">
          {value}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline text-inherit">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left bg-transparent border-0 p-0 text-inherit cursor-pointer"
      >
        {content}
      </button>
    );
  }
  return content;
}
