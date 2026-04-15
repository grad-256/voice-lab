"use client";

import { useEffect } from "react";

/**
 * URL に `?debug=1` が付いているときだけ eruda（モバイル向け DevTools）を読み込む。
 * Android / iOS 実機デバッグ用。CDN 経由で読むので package.json への依存追加は不要。
 *
 * ⚠️ 一時的なデバッグ用途。診断が終わったらこのファイルと layout.tsx の呼び出しを削除して
 * 本番へマージすること（プレビュー環境でのみ使う前提で、本番向けの保護層は入れていない）。
 */

declare global {
  interface Window {
    eruda?: { init: () => void };
  }
}

// semver で固定して jsDelivr 側の patch 更新の影響を受けないようにする
const ERUDA_SRC = "https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.min.js";

export function DebugConsole() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "1") return;

    // 既に init 済み（HMR / React Strict Mode の二重マウント）なら何もしない
    if (window.eruda) {
      window.eruda.init();
      return;
    }
    if (document.getElementById("__eruda_script")) return;

    const script = document.createElement("script");
    script.id = "__eruda_script";
    script.src = ERUDA_SRC;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.eruda?.init();
    };
    script.onerror = () => {
      console.warn("[DebugConsole] eruda の読み込みに失敗しました");
      document.getElementById("__eruda_script")?.remove();
    };
    document.body.appendChild(script);
  }, []);

  return null;
}
