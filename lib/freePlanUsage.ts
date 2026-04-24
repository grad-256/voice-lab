// フリープランの利用制限定数・型・純粋関数
// DB 操作は含まない（テスト容易性を担保するため）

export const FREE_TURN_LIMIT = 5;
export const GUEST_COOKIE_NAME = "vl_guest_id";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30日

export type UsageRow = { turns: number } | null;
export type UsageCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "TURN_LIMIT_EXCEEDED" };

/**
 * ターン数が上限に達しているか確認する。
 * usage が null（レコード未作成）の場合は 0 として扱う。
 */
export function checkTurnLimit(usage: UsageRow): UsageCheckResult {
  if ((usage?.turns ?? 0) >= FREE_TURN_LIMIT) {
    return { allowed: false, reason: "TURN_LIMIT_EXCEEDED" };
  }
  return { allowed: true };
}

/**
 * Cookie ヘッダ文字列から指定名のクッキー値を取得する。
 * Edge Runtime 対応のため document.cookie は使わず、ヘッダ文字列をパースする。
 */
export function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${encodeURIComponent(name)}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
