/**
 * テーマ（Dark / Light / System）を管理する localStorage ベースの軽量モジュール。
 *
 * 方針：
 *   - 3 択（System / Light / Dark）。System は OS の prefers-color-scheme に追従。
 *   - 実テーマは `<html data-theme="light|dark">` で適用。CSS 側は globals.css を参照。
 *   - 永続化は localStorage のみ（認証不要）。DB 同期は将来の課題。
 *   - FOUC 防止のため、初期テーマ解決は `THEME_INIT_SCRIPT` を <body> 先頭で同期実行する。
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme_preference";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** localStorage から保存済みの選択を読む。SSR や未設定時は "system"。 */
export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(raw) ? raw : "system";
}

/** 選択を localStorage に書き込む。SSR では何もしない。 */
export function setStoredThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, preference);
}

/**
 * System 選択時は OS の prefers-color-scheme を読んで light/dark に解決。
 * SSR 環境では "dark"（既定）にフォールバック。
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** 解決済みテーマを <html data-theme> に反映。 */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

/**
 * System 追従を購読する。preference === "system" のときのみ OS 変更に反応して
 * data-theme を更新したい。返り値は解除関数。
 */
export function subscribeSystemTheme(callback: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: light)");
  const handler = (event: MediaQueryListEvent) => {
    callback(event.matches ? "light" : "dark");
  };
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}

/**
 * FOUC 防止用の同期インラインスクリプト。
 * <body> 直下にインライン <script> として埋め込む想定。
 * localStorage と OS 設定を読んで html の data-theme を React レンダリング前に決定する。
 *
 * 追加ルール：LP ルート（`/`、`/ja`、`/en` など locale ルート直下）はブランドトーン維持のため
 * 常にダークで表示する。ここで判定しておかないと、React 側の LocaleShellThemeLock が
 * useEffect で上書きするまで一瞬 light のまま描画される（FOUC）。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(STORAGE_KEY)};var v=localStorage.getItem(k);var pref=(v==="light"||v==="dark"||v==="system")?v:"system";var resolved=pref==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):pref;var p=location.pathname;var seg=p.split("/").filter(Boolean);var isLanding=seg.length===0||(seg.length===1&&(seg[0]==="ja"||seg[0]==="en"));if(isLanding)resolved="dark";document.documentElement.dataset.theme=resolved;}catch(e){}})();`;
