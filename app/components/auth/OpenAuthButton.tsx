"use client";

// Server Component（LP など）から AuthDialog を開くための軽量ボタン。
// useAuth フックがクライアント境界にしか存在しないため、このラッパー越しに呼ぶ。

import { type AuthMode, useAuth } from "@/app/components/auth/AuthContext";
import type { ReactNode } from "react";

type Props = {
  mode?: AuthMode;
  className?: string;
  children: ReactNode;
};

export function OpenAuthButton({ mode = "login", className, children }: Props) {
  const { openDialog } = useAuth();
  return (
    <button type="button" onClick={() => openDialog(mode)} className={className}>
      {children}
    </button>
  );
}
