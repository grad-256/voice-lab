"use client";

// PWA インストール導線用フック。
// Android Chrome の `beforeinstallprompt` を捕まえ、ボタンから OS のインストールダイアログを呼ぶ。
// PC は誤タップ回避のため `isMobileDevice()` で除外。iOS Safari / Firefox は非対応で自動非表示。
// 前提：`PostHogProvider` 配下で使うこと。init 未了ロスを `posthog.__loaded` でガード。

import posthog from "posthog-js";
import { useCallback, useEffect, useState } from "react";

// shown イベントの重複発火防止キー（Hero + Navbar の 2 インスタンスで 1 session 1 回に集約）
const SHOWN_SESSION_KEY = "voicelab_pwa_install_shown_fired";

type PromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: PromptOutcome; platform: string }>;
  prompt(): Promise<void>;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(display-mode: standalone)");
    if (mql.matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (!isMobileDevice()) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 外部経路（Chrome メニュー等）で install された場合は userChoice を経由せず appinstalled のみ発火。
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // appinstalled が発火しない環境向けの保険（display-mode の変化で installed を判定）。
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mql.addEventListener("change", handleDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mql.removeEventListener("change", handleDisplayChange);
    };
  }, []);

  useEffect(() => {
    if (!deferredPrompt || isInstalled || !posthog.__loaded) return;
    try {
      if (sessionStorage.getItem(SHOWN_SESSION_KEY) === "1") return;
      posthog.capture("pwa_install_button_shown");
      sessionStorage.setItem(SHOWN_SESSION_KEY, "1");
    } catch {}
  }, [deferredPrompt, isInstalled]);

  const promptInstall = useCallback(
    async (placement?: string) => {
      // 再入防止：同一イベントに対する 2 回目の prompt() は Chrome 仕様違反のため即クリア。
      const ev = deferredPrompt;
      if (!ev) return;
      setDeferredPrompt(null);

      if (posthog.__loaded) {
        posthog.capture("pwa_install_button_clicked", placement ? { placement } : undefined);
      }
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (posthog.__loaded) {
        posthog.capture("pwa_install_prompt_outcome", {
          outcome,
          ...(placement ? { placement } : {}),
        });
      }
    },
    [deferredPrompt]
  );

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
