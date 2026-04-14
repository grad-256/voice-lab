import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VOICE_SESSION_STORAGE_KEY,
  clearGuestSelectedVoiceId,
  getGuestSelectedVoiceId,
  setGuestSelectedVoiceId,
} from "./voiceSessionStorage";

// node 環境に localStorage モックを用意（guestUsage.test.ts と同形）
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

describe("voiceSessionStorage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("未設定時は null", () => {
    expect(getGuestSelectedVoiceId()).toBeNull();
  });

  it("set → get で同じ値が返る", () => {
    setGuestSelectedVoiceId("dn9HtxgDwCH96MVX9iAO");
    expect(getGuestSelectedVoiceId()).toBe("dn9HtxgDwCH96MVX9iAO");
  });

  it("set 後に clear すると null", () => {
    setGuestSelectedVoiceId("dn9HtxgDwCH96MVX9iAO");
    clearGuestSelectedVoiceId();
    expect(getGuestSelectedVoiceId()).toBeNull();
  });

  it("set は同一キーで上書きされる（再マッチング想定）", () => {
    setGuestSelectedVoiceId("voice-a");
    setGuestSelectedVoiceId("voice-b");
    expect(getGuestSelectedVoiceId()).toBe("voice-b");
  });

  it("空文字を set すると例外", () => {
    expect(() => setGuestSelectedVoiceId("")).toThrow(/形式が不正/);
  });

  it("64 文字超を set すると例外", () => {
    expect(() => setGuestSelectedVoiceId("a".repeat(65))).toThrow(/形式が不正/);
  });

  it("改行混入を set すると例外", () => {
    expect(() => setGuestSelectedVoiceId("voice\nid")).toThrow(/形式が不正/);
  });

  it("過去に壊れた値（空文字）が直接書かれていても get は null", () => {
    localStorageMock.setItem(VOICE_SESSION_STORAGE_KEY, "");
    expect(getGuestSelectedVoiceId()).toBeNull();
  });

  it("過去に壊れた値（改行混入）が直接書かれていても get は null", () => {
    localStorageMock.setItem(VOICE_SESSION_STORAGE_KEY, "broken\nvalue");
    expect(getGuestSelectedVoiceId()).toBeNull();
  });

  it("SSR 環境（localStorage 未定義）でも例外を投げない", () => {
    // localStorage を一時的に未定義化
    const orig = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(getGuestSelectedVoiceId()).toBeNull();
    expect(() => setGuestSelectedVoiceId("x")).not.toThrow();
    expect(() => clearGuestSelectedVoiceId()).not.toThrow();

    // 復元
    Object.defineProperty(globalThis, "localStorage", {
      value: orig,
      writable: true,
      configurable: true,
    });
  });
});
