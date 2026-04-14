import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// -------------------------------------------------------
// POST /api/suggest — インテグレーションテスト
//
// Sprint 3 で新設、Sprint 4 で recent_messages / timing に拡張。
// 外部 API（Anthropic）を fetch モックで代替し、
// 400 ガード条件とフォールバック挙動を検証する。
// -------------------------------------------------------

function mockAnthropicOk(text: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ content: [{ type: "text", text }] }),
  };
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/suggest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Sprint 3 互換：ja_text 単独で 200 を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockAnthropicOk('{"phrases":[{"ja_intent":"挨拶","en_text":"Hi there."}]}')
        )
    );
    const res = await POST(buildRequest({ ja_text: "こんにちは" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { phrases: Array<{ en_text: string }> };
    expect(data.phrases[0].en_text).toBe("Hi there.");
  });

  it("timing=before_chat は ja_text 空でも 200 を返す（オープナー生成）", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockAnthropicOk('{"phrases":[{"ja_intent":"切り出し","en_text":"Hey, how are you?"}]}')
        )
    );
    const res = await POST(buildRequest({ ja_text: "", timing: "before_chat" }));
    expect(res.status).toBe(200);
  });

  it("timing=during_chat は recent_messages があれば ja_text 空でも 200 を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockAnthropicOk('{"phrases":[{"ja_intent":"相づち","en_text":"That sounds great."}]}')
        )
    );
    const res = await POST(
      buildRequest({
        ja_text: "",
        timing: "during_chat",
        recent_messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi, how are you?" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { phrases: Array<{ en_text: string }> };
    expect(data.phrases.length).toBeGreaterThan(0);
  });

  it("timing=during_chat でも recent_messages が空なら 400 を返す（ヒント情報不足）", async () => {
    const res = await POST(
      buildRequest({ ja_text: "", timing: "during_chat", recent_messages: [] })
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toMatch(/ja_text|recent_messages/);
  });

  it("timing 未指定 + ja_text 空は 400（モーダル経路の従来仕様）", async () => {
    const res = await POST(buildRequest({ ja_text: "" }));
    expect(res.status).toBe(400);
  });

  it("upstream 5xx でフォールバック 3 件を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );
    const res = await POST(buildRequest({ ja_text: "困ったとき" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { phrases: unknown[]; fallback: boolean };
    expect(data.fallback).toBe(true);
    expect(data.phrases).toHaveLength(3);
  });

  it("不正な recent_messages は無視される（role/content 検証）", async () => {
    // recent_messages が全て不正 → hasRecent=false
    // before_chat でない、timing 未指定、ja_text 空 → 400 になることを確認
    const res = await POST(
      buildRequest({
        ja_text: "",
        recent_messages: [
          { role: "bot", content: "x" }, // role 不正
          { role: "user", content: 123 }, // content 型不正
          { role: "user", content: "" }, // 空文字
        ],
      })
    );
    expect(res.status).toBe(400);
  });
});
