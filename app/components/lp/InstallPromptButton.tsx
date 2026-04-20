"use client";

import { usePwaInstall } from "@/lib/usePwaInstall";

type Props = {
  label: string;
  className?: string;
};

// `beforeinstallprompt` が発火したモバイル端末でだけ描画される PWA インストールボタン。
// PC Chrome / Edge では `usePwaInstall` が非表示判定するため、Server Component 側では
// 単純に配置するだけでよい。iOS Safari / Firefox もイベント非対応のため同様に非表示。
export function InstallPromptButton({ label, className }: Props) {
  const { canInstall, promptInstall } = usePwaInstall();
  if (!canInstall) return null;
  return (
    <button type="button" onClick={promptInstall} className={className}>
      {label}
    </button>
  );
}
