import { describe, expect, it, vi } from "vitest";
import { migrateGuestVoiceToAuth } from "./voiceSessionMigration";

function makeDeps(overrides: {
  local?: string | null;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const clearLocal = vi.fn();
  const getLocal = vi.fn(() => overrides.local ?? null);
  const fetch = vi.fn<typeof globalThis.fetch>(
    overrides.fetchImpl ?? (() => Promise.resolve(new Response("{}")))
  );
  return { getLocal, clearLocal, fetch };
}

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("migrateGuestVoiceToAuth", () => {
  it("localStorage が空なら no-local を返し fetch も呼ばない", async () => {
    const deps = makeDeps({ local: null });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "no-local" });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.clearLocal).not.toHaveBeenCalled();
  });

  it("成功時に POST → localStorage 削除 → migrated:true", async () => {
    const deps = makeDeps({
      local: "voice-x",
      fetchImpl: async () => jsonResponse(200, { voiceId: "voice-x" }),
    });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: true, voiceId: "voice-x" });
    expect(deps.fetch).toHaveBeenCalledOnce();
    const call = deps.fetch.mock.calls[0];
    expect(call[0]).toBe("/api/voice-session");
    const init = call[1];
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({ selectedVoiceId: "voice-x" });
    expect(deps.clearLocal).toHaveBeenCalledOnce();
  });

  it("空文字は invalid-local + 自動クリアで終わる（fetch しない）", async () => {
    const deps = makeDeps({ local: "" });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "invalid-local" });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.clearLocal).toHaveBeenCalledOnce();
  });

  it("64 文字超は invalid-local + 自動クリア", async () => {
    const deps = makeDeps({ local: "a".repeat(65) });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "invalid-local" });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.clearLocal).toHaveBeenCalledOnce();
  });

  it("改行混入は invalid-local + 自動クリア", async () => {
    const deps = makeDeps({ local: "voice\nx" });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "invalid-local" });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.clearLocal).toHaveBeenCalledOnce();
  });

  it("401 は unauthenticated + localStorage 保持（リトライ可能）", async () => {
    const deps = makeDeps({
      local: "voice-x",
      fetchImpl: async () => jsonResponse(401, { error: "認証が必要です" }),
    });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "unauthenticated" });
    expect(deps.clearLocal).not.toHaveBeenCalled();
  });

  it("500 系は api-error + localStorage 保持", async () => {
    const deps = makeDeps({
      local: "voice-x",
      fetchImpl: async () => jsonResponse(500, { error: "内部エラー" }),
    });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "api-error" });
    expect(deps.clearLocal).not.toHaveBeenCalled();
  });

  it("fetch 例外（ネットワーク断）でも throw せず api-error を返す + 保持", async () => {
    const deps = makeDeps({
      local: "voice-x",
      fetchImpl: () => {
        throw new Error("network down");
      },
    });
    const result = await migrateGuestVoiceToAuth(deps);
    expect(result).toEqual({ migrated: false, reason: "api-error" });
    expect(deps.clearLocal).not.toHaveBeenCalled();
  });
});
