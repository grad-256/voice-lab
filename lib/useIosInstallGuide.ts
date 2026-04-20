"use client";

// iOS Safari 向け「ホーム画面に追加」案内モーダルの表示可否を判定するフック。
//
// iOS Safari は `beforeinstallprompt` を発火しないため `usePwaInstall` 側では
// 検出できない。こちらで UA とナビゲータ状態から独立に「iOS Safari で、かつ
// スタンドアロン起動ではない」ケースを判定し、モーダル起動ボタンを出す土台とする。
//
// 前提：このフックは `PostHogProvider` 配下で使うこと（open 時に
// `pwa_ios_guide_opened` を送信する）。
//
// localStorage キー `voicelab_ios_install_guide_hidden` に "1" を保存すると、
// 「もう表示しない」として trigger ボタンを以後非表示にする。

import posthog from "posthog-js";
import { useCallback, useEffect, useState } from "react";

const HIDE_STORAGE_KEY = "voicelab_ios_install_guide_hidden";

// iOS 判定：iPadOS 13+ は UA が Mac を名乗るため、touch 対応 + platform で補正する。
// 併せて Chrome on iOS (CriOS) / Firefox on iOS (FxiOS) / Edge on iOS (EdgiOS) を除外する。
// これらのブラウザは WKWebView 由来で「ホーム画面に追加」フローが Safari と異なり、
// Safari に誘導しても遷移しないため、案内対象から外す。
function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIosDevice =
    /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS 13+ の詐称 UA 対応。Mac UA かつタッチ操作可能 = iPad と判定する。
    (/Macintosh/.test(ua) &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1);
  if (!isIosDevice) return false;
  // Safari 以外の iOS ブラウザを除外
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(ua)) return false;
  // Safari を含むこと（WKWebView のアプリ内ブラウザでも "Safari" は入るが、一般的な
  // 誤検知は低頻度なので許容する。必要があれば後続 PR で厳密化する）
  return /Safari/.test(ua);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari 固有：navigator.standalone === true がホーム画面から起動した印。
  // 型定義には無いが実在するプロパティ。
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function useIosInstallGuide() {
  // SSR で hydrate 不一致を起こさないよう、初期値は「表示不可」に倒す。
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsIosSafari(detectIosSafari());
    setIsStandalone(detectStandalone());
    try {
      setIsHidden(localStorage.getItem(HIDE_STORAGE_KEY) === "1");
    } catch {
      // localStorage が無効（プライベートモード等）なら「表示する」方向に倒す。
    }
  }, []);

  const open = useCallback((placement?: string) => {
    setIsOpen(true);
    if (posthog.__loaded) {
      posthog.capture("pwa_ios_guide_opened", placement ? { placement } : undefined);
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dismissPermanently = useCallback(() => {
    try {
      localStorage.setItem(HIDE_STORAGE_KEY, "1");
    } catch {
      // no-op：保存できなければ都度表示される挙動で UX は保たれる。
    }
    setIsHidden(true);
    setIsOpen(false);
    if (posthog.__loaded) {
      posthog.capture("pwa_ios_guide_dismissed_permanently");
    }
  }, []);

  return {
    // iOS Safari かつスタンドアロン未起動かつ「もう表示しない」未選択のときのみ trigger を出す。
    canShowGuide: isIosSafari && !isStandalone && !isHidden,
    isOpen,
    open,
    close,
    dismissPermanently,
  };
}
