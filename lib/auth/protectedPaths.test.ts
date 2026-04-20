import { describe, expect, test } from "vitest";
import { isDialogOpenablePath, isProtectedPath, stripLocale } from "./protectedPaths";

describe("isProtectedPath", () => {
  test("/me 系は保護対象", () => {
    expect(isProtectedPath("/me")).toBe(true);
    expect(isProtectedPath("/me/voice")).toBe(true);
    expect(isProtectedPath("/me/password")).toBe(true);
  });

  test("/diary/history 系は保護対象", () => {
    expect(isProtectedPath("/diary/history")).toBe(true);
    expect(isProtectedPath("/diary/history/abc-123")).toBe(true);
  });

  test("公開・ゲスト利用可のページは保護対象外", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/app")).toBe(false);
    expect(isProtectedPath("/diary")).toBe(false);
    expect(isProtectedPath("/reset-password")).toBe(false);
    expect(isProtectedPath("/privacy")).toBe(false);
    expect(isProtectedPath("/terms")).toBe(false);
  });

  test("/memo のような /me プリフィクス近接の誤マッチ防止", () => {
    // /me と /memo は別物。/me は保護、/memo は保護外。
    expect(isProtectedPath("/memo")).toBe(false);
  });
});

describe("isDialogOpenablePath", () => {
  test("LP とリセットパスワード以外ではダイアログを開く", () => {
    expect(isDialogOpenablePath("/app")).toBe(true);
    expect(isDialogOpenablePath("/diary")).toBe(true);
    expect(isDialogOpenablePath("/me")).toBe(true);
    expect(isDialogOpenablePath("/diary/history")).toBe(true);
    expect(isDialogOpenablePath("/privacy")).toBe(true);
    expect(isDialogOpenablePath("/terms")).toBe(true);
  });

  test("LP とリセットパスワードでは開かない", () => {
    expect(isDialogOpenablePath("/")).toBe(false);
    expect(isDialogOpenablePath("/reset-password")).toBe(false);
  });
});

describe("stripLocale", () => {
  const locales = ["ja", "en"] as const;

  test("locale プリフィクスを削除する", () => {
    expect(stripLocale("/ja/me", locales)).toBe("/me");
    expect(stripLocale("/en/diary/history/abc", locales)).toBe("/diary/history/abc");
  });

  test("locale 単独のパスは '/' を返す", () => {
    expect(stripLocale("/en", locales)).toBe("/");
    expect(stripLocale("/ja", locales)).toBe("/");
  });

  test("プリフィクスなしのパスはそのまま返す", () => {
    expect(stripLocale("/me", locales)).toBe("/me");
    expect(stripLocale("/diary", locales)).toBe("/diary");
    expect(stripLocale("/", locales)).toBe("/");
  });

  test("最初のセグメントが locale と一致しない場合もそのまま", () => {
    expect(stripLocale("/memo", locales)).toBe("/memo");
  });
});
