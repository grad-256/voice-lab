/**
 * ゲストユーザーの利用回数管理
 * localStorage で vl_guest_count キーを管理する純粋関数
 * SSR（typeof localStorage === "undefined"）に対応
 */

export const GUEST_LIMIT = 5;
export const STORAGE_KEY = "vl_guest_count";

// GUEST_LIMIT に加算される 4 種のイベント（mvp-scope.md 7.Q2）
export type GuestEvent = "chat" | "voice_creation" | "suggest" | "phrase_play";

export function getGuestCount(): number {
  if (typeof localStorage === "undefined") return 0;
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === null) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// event 引数は呼び出し側の分類用（PostHog 等に渡される）。
// カウンタ自体は種別を問わず +1 の同一カウンタ（Q2 決定）。
export function incrementGuestCount(_event: GuestEvent): number {
  if (typeof localStorage === "undefined") return 0;
  const next = getGuestCount() + 1;
  localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}

export function resetGuestCount(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "0");
}

export function isGuestLimitReached(): boolean {
  return getGuestCount() >= GUEST_LIMIT;
}
