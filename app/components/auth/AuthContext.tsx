"use client";

// グローバル認証ダイアログの中心ストア。
// - Supabase の auth セッションを購読して user を最新化（SSR とは別経路）
// - AuthDialog の open / close / mode を一箇所で管理
// - 任意のクライアント側コンポーネントが useAuth() で呼び出せる
//
// SSR と CSR のセッション同期ズレによるダイアログのチラつきを避けるため、
// getUser() が返るまでは loading=true を維持し、その間 AuthGate はダイアログを開かない。

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthMode = "login" | "signup" | "forgot";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isOpen: boolean;
  mode: AuthMode;
  openDialog: (mode?: AuthMode) => void;
  closeDialog: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // 初回は getUser() でサーバー検証済みのセッションを取得する。
    // getSession() はローカルの cookie を見るだけなので、
    // getUser() の方が「確実に認証済みか」の判定に向く。
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    // 以降の変化は onAuthStateChange で追従する。
    // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED いずれもここで拾える。
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ログインに成功したら自動でダイアログを閉じる。
  // 現画面の文脈（下書き日記・場面選択 等）を壊さない要件のため。
  useEffect(() => {
    if (user && isOpen) {
      setIsOpen(false);
    }
  }, [user, isOpen]);

  const openDialog = useCallback((next?: AuthMode) => {
    setMode(next ?? "login");
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isOpen, mode, openDialog, closeDialog }),
    [user, loading, isOpen, mode, openDialog, closeDialog]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
