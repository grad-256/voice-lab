// 認証ダイアログの表示判定に使う純粋関数群。
// middleware (SSR) からもクライアント側の AuthGate からも同じロジックで判定したいため
// 純粋関数として切り出している。Next.js / next-intl への依存は持たない（テスト容易性のため）。
// routing.locales を渡す必要がある呼び出し側は `@/i18n/routing` から直接 import すること。

// 保護パス：未ログインでアクセスされたらダイアログを開き、閉じられたら /app に退避する。
// マッチ規則は「完全一致またはサフィックス付き」で、/me 系と /diary/history 系を対象にする。
const PROTECTED_PREFIXES = ["/me", "/diary/history"] as const;

// ダイアログ表示対象外パス：LP とパスワード再設定ページのみ。
// /reset-password はメールリンク経由で到達する専用画面のため、未ログインでも AuthGate を起動しない。
const DIALOG_EXCLUDED_PATHS = new Set<string>(["/", "/reset-password"]);

// 先頭の locale セグメントを取り除いてプリフィクスのないパスに戻す。
// next-intl の URL ベース設計（/ja は prefix なし、/en は prefix あり）と中立に動くように、
// locales 配列を引数で受け取る形にしている（テスト容易性も確保）。
export function stripLocale(pathname: string, locales: readonly string[]): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  const [first, ...rest] = segments;
  if (locales.includes(first)) {
    return rest.length === 0 ? "/" : `/${rest.join("/")}`;
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

// 与えられたパス（locale プリフィクスなし）が保護対象か判定する。
// 保護パス：未ログインでのアクセス時、ダイアログを閉じられたら /app に戻す。
export function isProtectedPath(barePath: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => barePath === prefix || barePath.startsWith(`${prefix}/`)
  );
}

// 与えられたパス（locale プリフィクスなし）で AuthGate を発火させるべきか判定する。
// 未ログイン時に自動でダイアログを出すのは、LP とリセットパスワード画面以外すべて。
export function isDialogOpenablePath(barePath: string): boolean {
  return !DIALOG_EXCLUDED_PATHS.has(barePath);
}
