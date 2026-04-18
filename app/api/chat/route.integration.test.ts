import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// -------------------------------------------------------
// POST /api/chat — インテグレーションテスト
//
// 外部 API（Anthropic）を fetch モックで代替し、
// ルートハンドラ全体の入出力・エラーハンドリングを検証する
// -------------------------------------------------------

/** Anthropic API のレスポンスを生成するヘルパー */
function mockAnthropicResponse(text: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ type: "text", text }],
      }),
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("正常なリクエストで reply と translation を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse('{"reply": "Hello!", "translation": "こんにちは！"}')
        )
    );

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hi", history: [] }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.text).toBe("Hello!");
    expect(data.translation).toBe("こんにちは！");
  });

  it("コードフェンス付き JSON でも正しくパースされる", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse('```json\n{"reply": "Nice!", "translation": "いいね！"}\n```')
        )
    );

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Cool", history: [] }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.text).toBe("Nice!");
    expect(data.translation).toBe("いいね！");
  });

  it("message が空のとき 400 を返す", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "", history: [] }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it("Anthropic API がエラーを返したとき日本語エラーメッセージを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Internal Server Error"),
      })
    );

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello", history: [] }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    // エラーメッセージが日本語であること
    expect(data.error).toMatch(/[ぁ-ん]+|[ァ-ン]+|[一-龯]+/);
  });

  it("history が Anthropic API に正しく渡される", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockAnthropicResponse('{"reply": "Good!", "translation": "いいね！"}'));
    vi.stubGlobal("fetch", fetchMock);

    const history = [
      { role: "user" as const, content: "First message" },
      { role: "assistant" as const, content: "First reply" },
    ];

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Second message", history }),
    });

    await POST(req);

    // fetch が呼ばれたとき、body に history + 新しいメッセージが含まれていること
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.messages).toHaveLength(3); // history 2 + 新規 1
    expect(callBody.messages[2].content).toBe("Second message");
  });

  it("locale=en のとき system prompt に translation:null 指示が含まれる", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockAnthropicResponse('{"reply": "Hi!", "translation": null}'));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello", history: [], locale: "en" }),
    });

    await POST(req);

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.system).toContain('"translation": null');
  });

  it("locale=en + mode=diary のとき system prompt が英語オープナー指示になる", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockAnthropicResponse('{"reply": "Hey!", "translation": null}'));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [],
        mode: "diary",
        assistantFirst: true,
        locale: "en",
      }),
    });

    await POST(req);

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.system).toContain("greet the user casually in English");
    expect(callBody.system).not.toContain("今日どうだった？");
  });
});
