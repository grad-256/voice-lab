"use client";

import { usePwaInstall } from "@/lib/usePwaInstall";
import type { ReactNode } from "react";

type Props = {
  // ReactNode を許容し、Navbar 側はアイコン+テキストの混在表現を渡せるようにする。
  label: ReactNode;
  className?: string;
  // 計測上の場所区別（hero / navbar）。PostHog イベントでの内訳取得に使う。
  posthogPlacement?: string;
  ariaLabel?: string;
};

// `beforeinstallprompt` が発火したモバイル端末でだけ描画される PWA インストールボタン。
// PC Chrome / Edge では `usePwaInstall` が非表示判定するため、Server Component 側では
// 単純に配置するだけでよい。iOS Safari / Firefox もイベント非対応のため同様に非表示。
export function InstallPromptButton({ label, className, posthogPlacement, ariaLabel }: Props) {
  const { canInstall, promptInstall } = usePwaInstall();
  if (!canInstall) return null;
  return (
    <button
      type="button"
      onClick={() => promptInstall(posthogPlacement)}
      className={className}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
