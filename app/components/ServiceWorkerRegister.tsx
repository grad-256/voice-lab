"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker 登録に失敗:", err);
        const message = err instanceof Error ? err.message : String(err);
        posthog.capture("sw_register_failed", {
          error: message,
          userAgent: navigator.userAgent,
        });
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
