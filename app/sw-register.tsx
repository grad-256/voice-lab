"use client";

import { useEffect } from "react";

// Service Worker を登録するだけの軽量クライアントコンポーネント
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return null;
}
