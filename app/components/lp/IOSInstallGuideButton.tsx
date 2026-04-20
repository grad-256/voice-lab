"use client";

// iOS Safari でのみ表示される「ホーム画面に追加」案内モーダル起動ボタン。
// `usePwaInstall` は iOS で canInstall=false になるため、Hero / Navbar で
// InstallPromptButton と並べて配置しても両方が同時に表示されることは無い。
//
// モーダル本体は同一ファイル構成内の IOSInstallGuideModal に委譲する。

import { useIosInstallGuide } from "@/lib/useIosInstallGuide";
import type { ReactNode } from "react";
import { IOSInstallGuideModal } from "./IOSInstallGuideModal";

type Props = {
  label: ReactNode;
  className?: string;
  posthogPlacement?: string;
  ariaLabel?: string;
};

export function IOSInstallGuideButton({ label, className, posthogPlacement, ariaLabel }: Props) {
  const { canShowGuide, isOpen, open, close, dismissPermanently } = useIosInstallGuide();
  if (!canShowGuide) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => open(posthogPlacement)}
        className={className}
        aria-label={ariaLabel}
      >
        {label}
      </button>
      <IOSInstallGuideModal
        isOpen={isOpen}
        onClose={close}
        onDismissPermanently={dismissPermanently}
      />
    </>
  );
}
