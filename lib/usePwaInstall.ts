"use client";

// PWA インストール導線用フック。
// Android Chrome が発火する `beforeinstallprompt` を捕まえ、ボタンから OS の
// インストールダイアログを呼べるようにする。PC Chrome / Edge でも同イベントは
// 発火するが、誤タップでの予期せぬアプリ化を避けるためモバイル端末のみで
// `canInstall` を true にする方針。
// iOS Safari / Firefox など `beforeinstallprompt` 非対応ブラウザでは
// `canInstall` が false のままとなり、呼び出し側はボタンを自動的に非表示にできる。
//
// 前提：このフックは `PostHogProvider`（app/components/PostHogProvider.tsx）配下で使うこと。
// PostHog は親の useEffect で非同期に init されるため、init 未了の瞬間に capture が
// no-op となって計測を取りこぼす可能性がある。`posthog.__loaded` をガードに使い、
// 初期化が完了するまで shown イベントも「送った」扱いにしないことでロスを防ぐ。

import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";

type PromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: PromptOutcome; platform: string }>;
  prompt(): Promise<void>;
}

// navigator.userAgentData は Chromium 系で実装済み。存在すれば `mobile` で確実に判定できる。
// 未実装ブラウザ（Firefox / Safari）では UA 文字列にフォールバックするが、そもそも
// それらは beforeinstallprompt を発火させないためフォールバックが使われるのは稀なケース。
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  // 「ボタンが表示可能になった」瞬間のイベントを 1 回だけ送るためのガード
  const shownCapturedRef = useRef(false);

  useEffect(() => {
    // client component は SSR でも評価されるため明示的にガードする。
    // 補足：`beforeinstallprompt` は Chrome が install criteria を満たした直後に
    // 一度だけ発火する。LP 直ランディングの初回ロードで捕まえる前提で登録する。
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(display-mode: standalone)");
    if (mql.matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // PC ではインストール導線の対象外。beforeinstallprompt を捕まえても state に保持しない。
      if (!isMobileDevice()) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Chrome メニューやアドレスバー右端からの外部経路でインストールが成功した場合、
    // `userChoice` は経由せず `appinstalled` だけが発火する。このタブ側では遷移せず、
    // ボタンだけを引っ込めて isInstalled を立てる。
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // `appinstalled` が発火しない環境（一部の Chromium 変種 / 手動インストール）でも
    // display-mode の変化を拾って isInstalled を更新する保険。
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
    if (!deferredPrompt || isInstalled || shownCapturedRef.current) return;
    // PostHog init 未了なら送信も「送信済み」扱いも保留し、次の render で再評価させる。
    // こうすることで Provider の init が後から完了しても初回 shown を取り逃さない。
    if (!posthog.__loaded) return;
    shownCapturedRef.current = true;
    posthog.capture("pwa_install_button_shown");
  }, [deferredPrompt, isInstalled]);

  const promptInstall = useCallback(async () => {
    // 再入防止：Chrome は同一 beforeinstallprompt イベントに対する 2 回目の prompt() を
    // 仕様違反として投げるため、先頭で local 変数に退避して state を即クリアする。
    // dismissed の場合もイベントは使い捨てになる（Chrome はクールダウンを挟むまで再発火
    // しないため）。保持せず破棄する方針でユーザー体験と整合する。
    const ev = deferredPrompt;
    if (!ev) return;
    setDeferredPrompt(null);

    if (posthog.__loaded) {
      posthog.capture("pwa_install_button_clicked");
    }
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (posthog.__loaded) {
      posthog.capture("pwa_install_prompt_outcome", { outcome });
    }
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
