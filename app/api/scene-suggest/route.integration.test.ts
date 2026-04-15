import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// -------------------------------------------------------
// POST /api/scene-suggest — インテグレーションテスト
//
// Anthropic 呼び出しを fetch モックで代替し、
// 400 ガード / Sonnet 成功 / フォールバック / モデル ID を検証する。
// -------------------------------------------------------

function mockAnthropicOk(text: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ content: [{ type: "text", text }] }),
  };
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/scene-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  scene_id: "checkout",
  situation_ja: "レジで「カードで」「袋不要」と伝える場面",
  emotion_ja: "定型句なのに詰まる",
};

describe("POST /api/scene-suggest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("正常系：Sonnet 応答を 3 件返す", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockAnthropicOk(
        `{"phrases":[
          {"ja_intent":"カードで","en_text":"Card, please."},
          {"ja_intent":"袋不要","en_text":"I don't need a bag."},
          {"ja_intent":"領収書","en_text":"Can I have a receipt?"}
        ]}`
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      phrases: Array<{ phrase_id: string; en_text: string; en_text_normalized: string }>;
      fallback?: boolean;
    };
    expect(data.phrases).toHaveLength(3);
    expect(data.phrases[0].phrase_id).toBeTruthy();
    expect(data.phrases[0].en_text_normalized).toBe("card please");
    expect(data.fallback).toBeUndefined();
  });

  it("モデル ID は claude-sonnet-4-5（Haiku ではない）", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockAnthropicOk('{"phrases":[{"ja_intent":"x","en_text":"A."}]}'));
    vi.stubGlobal("fetch", fetchSpy);

    await POST(buildRequest(VALID_BODY));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload.model).toBe("claude-sonnet-4-5");
  });

  it("upstream 5xx でシーン別フォールバック 3 件を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      phrases: Array<{ en_text: string }>;
      fallback: boolean;
    };
    expect(data.fallback).toBe(true);
    expect(data.phrases).toHaveLength(3);
    // checkout scene のフォールバック先頭は "Card, please."
    expect(data.phrases[0].en_text).toBe("Card, please.");
  });

  it("Anthropic が壊れた JSON を返してもフォールバックで復帰", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockAnthropicOk("<not json at all>")));
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { fallback: boolean };
    expect(data.fallback).toBe(true);
  });

  it("未知 scene_id でもフォールバック（汎用フレーズ）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
    );
    const res = await POST(
      buildRequest({
        scene_id: "unknown-scene",
        situation_ja: "未知の場面",
        emotion_ja: "不安",
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      phrases: Array<{ en_text: string }>;
      fallback: boolean;
    };
    expect(data.fallback).toBe(true);
    expect(data.phrases).toHaveLength(3);
  });

  it("scene_id が空なら 400", async () => {
    const res = await POST(buildRequest({ scene_id: "", situation_ja: "x", emotion_ja: "y" }));
    expect(res.status).toBe(400);
  });

  it("situation_ja が空なら 400", async () => {
    const res = await POST(
      buildRequest({ scene_id: "checkout", situation_ja: "", emotion_ja: "y" })
    );
    expect(res.status).toBe(400);
  });

  it("JSON 本文でないなら 400", async () => {
    const req = new Request("http://localhost/api/scene-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
