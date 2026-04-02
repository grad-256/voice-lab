/**
 * ゲストユーザーの利用回数管理
 * localStorage で vl_guest_count キーを管理する純粋関数
 * SSR（typeof window === "undefined"）に対応
 */

export const GUEST_LIMIT = 5;
export const STORAGE_KEY = "vl_guest_count";

export function getGuestCount(): number {
  if (typeof localStorage === "undefined") return 0;
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === null) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function incrementGuestCount(): number {
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
