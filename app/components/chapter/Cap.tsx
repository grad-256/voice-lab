// Chapter 系譜の小見出し（9px / 0.4em tracking / uppercase）。
// ページ上部やセクション頭に「編集者ラベル」のような静けさを作る。

import type { CSSProperties, ReactNode } from "react";

type CapProps = {
  children: ReactNode;
  /** 下マージンの調整（デザイン上 10px がデフォルト、0 でセクション間の詰まり用） */
  mb?: number;
  className?: string;
};

export function Cap({ children, mb = 10, className }: CapProps) {
  // 画面幅に応じて sm:/md: で段階的に拡大する。Tailwind 標準 text-xs (12px) を md: から採用。
  const style: CSSProperties = { marginBottom: mb };
  return (
    <div
      className={`text-xs sm:text-sm uppercase tracking-[0.4em] text-[var(--fg-muted)] ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
