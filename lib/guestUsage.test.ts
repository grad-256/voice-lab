import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUEST_LIMIT,
  type GuestEvent,
  getGuestCount,
  incrementGuestCount,
  isGuestLimitReached,
  resetGuestCount,
} from "./guestUsage";

// -------------------------------------------------------
// guestUsage
// ゲストユーザーの利用回数管理をテスト
// -------------------------------------------------------

// node 環境に localStorage モックを用意
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  length: 0,
  key: vi.fn(() => null),
};

describe("guestUsage", () => {
  beforeEach(() => {
    // globalThis に localStorage を設定
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    // テスト後にクリーンアップ
    localStorageMock.clear();
  });

  it("getGuestCount() 未設定時に 0 を返す", () => {
    expect(getGuestCount()).toBe(0);
  });

  it("incrementGuestCount('chat') で 1 ずつ増える", () => {
    expect(incrementGuestCount("chat")).toBe(1);
    expect(incrementGuestCount("chat")).toBe(2);
    expect(incrementGuestCount("chat")).toBe(3);
    expect(getGuestCount()).toBe(3);
  });

  it("異なる event 種別でも同一カウンタに加算される（Q2 の統合カウント仕様）", () => {
    const events: GuestEvent[] = ["chat", "voice_creation", "suggest", "phrase_play"];
    events.forEach((event, i) => {
      expect(incrementGuestCount(event)).toBe(i + 1);
    });
    expect(getGuestCount()).toBe(4);
  });

  it(`incrementGuestCount() を ${GUEST_LIMIT} 回呼ぶと isGuestLimitReached() が true になる`, () => {
    for (let i = 0; i < GUEST_LIMIT; i++) {
      incrementGuestCount("chat");
    }
    expect(isGuestLimitReached()).toBe(true);
  });

  it("isGuestLimitReached() は上限未満で false を返す", () => {
    for (let i = 0; i < GUEST_LIMIT - 1; i++) {
      incrementGuestCount("chat");
    }
    expect(isGuestLimitReached()).toBe(false);
  });

  it("resetGuestCount() 後に 0 に戻る", () => {
    incrementGuestCount("chat");
    incrementGuestCount("voice_creation");
    expect(getGuestCount()).toBe(2);
    resetGuestCount();
    expect(getGuestCount()).toBe(0);
  });
});
