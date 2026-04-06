"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { type ReactNode, useEffect } from "react";

export default function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key) return;

    posthog.init(key, {
      api_host: host ?? "https://us.i.posthog.com",
      person_profiles: "identified_only", // ゲストは匿名、ログイン後に紐付け
      capture_pageview: true,             // ページビュー自動計測
      capture_pageleave: true,            // 離脱も記録
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
