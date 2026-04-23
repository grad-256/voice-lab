/**
 * テーマ管理（Dark / Light / System）。LP とアプリで別ストレージキーを使い連動させない。
 *   - LP ルート（`/`・`/ja`・`/en`） → `lp_theme_preference`
 *   - それ以外 → `theme_preference`（従来キー）
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const APP_STORAGE_KEY = "theme_preference";
const LP_STORAGE_KEY = "lp_theme_preference";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(APP_STORAGE_KEY);
  return isThemePreference(raw) ? raw : "system";
}

export function setStoredThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_STORAGE_KEY, preference);
}

export function getStoredLpThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(LP_STORAGE_KEY);
  return isThemePreference(raw) ? raw : "system";
}

export function setStoredLpThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LP_STORAGE_KEY, preference);
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

/** preference === "system" のとき OS 変更に反応する購読。返り値で解除。 */
export function subscribeSystemTheme(callback: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: light)");
  const handler = (event: MediaQueryListEvent) => {
    callback(event.matches ? "light" : "dark");
  };
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}

/** FOUC 防止。`<body>` 先頭で同期実行し、hydration 前に `<html data-theme>` を確定する。 */
export const THEME_INIT_SCRIPT = `(function(){try{var appKey=${JSON.stringify(APP_STORAGE_KEY)};var lpKey=${JSON.stringify(LP_STORAGE_KEY)};var p=location.pathname;var seg=p.split("/").filter(Boolean);var isLanding=seg.length===0||(seg.length===1&&(seg[0]==="ja"||seg[0]==="en"));var storageKey=isLanding?lpKey:appKey;var v=localStorage.getItem(storageKey);var pref=(v==="light"||v==="dark"||v==="system")?v:"system";var resolved=pref==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):pref;document.documentElement.dataset.theme=resolved;}catch(e){}})();`;
