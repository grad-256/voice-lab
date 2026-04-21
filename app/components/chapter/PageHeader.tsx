// Chapter 系譜の上部ヘッダ。"MyVoiceLab · No. 017" のような
// 紙の書物の「柱」を模した 3 点レイアウト。

import type { ReactNode } from "react";

type PageHeaderProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

export function PageHeader({ left = "MyVoiceLab", center, right }: PageHeaderProps) {
  // Cap と同じレンジで、広い画面では柱の活字を少し大きく見せる。
  return (
    <div className="flex items-center justify-between text-xs sm:text-sm uppercase tracking-[0.32em] text-[var(--fg-muted)]">
      <span>{left}</span>
      {center != null && <span>{center}</span>}
      <span>{right}</span>
    </div>
  );
}
