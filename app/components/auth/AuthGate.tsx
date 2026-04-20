"use client";

// 未ログイン時の AuthDialog 自動オープン + 保護ページからの退避を担当する。
// - user / pathname / loading のいずれかが変わったときに発火
// - loading === true の間は何もしない（SSR/CSR セッション同期前のチラつき防止）
// - user がある間は何もしない
// - user がなく、pathname が LP と /reset-password 以外なら openDialog("login")
// - ダイアログが close された時点で pathname が保護パスなら /app に退避する

import { useAuth } from "@/app/components/auth/AuthContext";
import { usePathname, useRouter } from "@/i18n/routing";
import { isDialogOpenablePath, isProtectedPath } from "@/lib/auth/protectedPaths";
import { useEffect, useRef } from "react";

export function AuthGate() {
  const { user, loading, isOpen, openDialog } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const prevIsOpen = useRef(false);

  // 未ログイン時の自動オープン。
  // usePathname() は next-intl が locale プリフィクスを除いた形で返す（例：/en/me → /me）。
  // 依存配列に isOpen は含めない：閉じた直後（isOpen が true→false に変わった瞬間）に
  // 再発火しないようにするため。pathname 変更時だけ再オープンする。
  // openDialog は AuthContext 側で useCallback(() => ..., []) で安定化している前提。
  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (!isDialogOpenablePath(pathname)) return;
    openDialog("login");
  }, [user, loading, pathname, openDialog]);

  // ダイアログが閉じられた瞬間の保護パス退避。
  // 閉じる前後で isOpen が true → false に落ちた場合だけ発火する。
  useEffect(() => {
    if (prevIsOpen.current === true && isOpen === false) {
      if (!user && isProtectedPath(pathname)) {
        router.replace("/app");
      }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, pathname, user, router]);

  // 自身は何も描画しない。副作用だけを担う境界コンポーネント。
  return null;
}
