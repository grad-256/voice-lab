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

// Supabase サーバークライアントのモック（デフォルト：ログイン済ユーザーを返す）
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Supabase 管理クライアントのモック
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** 認証済みユーザーを返す Supabase モックを設定する */
function setupAuthenticatedUser(
  userId = "test-user-id",
  usageData: { turns: number } | null = null
) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: usageData });
  const eqDateMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const eqUserMock = vi.fn().mockReturnValue({ eq: eqDateMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, upsert: upsertMock });

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
    from: fromMock,
  });
}

/** ゲストユーザー（未認証）を返す Supabase モックを設定する */
function setupGuestUser(usageData: { turns: number } | null = null) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(),
  });

  const maybeSingleMock = vi.fn().mockResolvedValue({ data: usageData });
  const eqDateMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const eqGuestMock = vi.fn().mockReturnValue({ eq: eqDateMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqGuestMock });
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, upsert: upsertMock });

  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: fromMock,
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setupAuthenticatedUser("test-user-id", null);
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
        status: 500,
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

  it("locale=en のとき system prompt が英語オープナー指示になる", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockAnthropicResponse('{"reply": "Hey!", "translation": null}'));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [],
        assistantFirst: true,
        locale: "en",
      }),
    });

    await POST(req);

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.system).toContain("greet the user casually in English");
    expect(callBody.system).not.toContain("今日どうだった？");
  });

  // Claude の LANGUAGE: Mirror the user's language ルールは、具体的なユーザー発話（日本語の
  // セッションマーカー）に引きずられて OPENING の英語指示を上書きしてしまう。セッションマーカー自体を
  // UI ロケールに合わせた英語にしておくことで、EN UI で日本語オープナーが返ってしまうバグを防ぐ。
  it("locale=en + assistantFirst のとき session marker が英語になる", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockAnthropicResponse('{"reply": "Hey!", "translation": null}'));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [],
        assistantFirst: true,
        locale: "en",
      }),
    });

    await POST(req);

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.messages).toEqual([{ role: "user", content: "(session start)" }]);
  });

  it("locale=ja + assistantFirst のとき session marker は日本語のまま", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockAnthropicResponse('{"reply": "こんにちは", "translation": null}'));
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [],
        assistantFirst: true,
        locale: "ja",
      }),
    });

    await POST(req);

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.messages).toEqual([{ role: "user", content: "（セッション開始）" }]);
  });

  // -------------------------------------------------------
  // フリープラン利用制限テスト
  // -------------------------------------------------------

  it("ログイン済ユーザーがターン上限に達したとき 403 + TURN_LIMIT_EXCEEDED を返す", async () => {
    // turns=5（上限 5 に達した状態）で設定
    setupAuthenticatedUser("test-user-id", { turns: 5 });

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // history に既存メッセージあり = セッション継続中のターン
        history: [{ role: "assistant", content: "こんにちは" }],
        message: "今日は疲れました",
        locale: "ja",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("TURN_LIMIT_EXCEEDED");
  });

  it("ゲストユーザーがターン上限に達したとき 403 + TURN_LIMIT_EXCEEDED を返す", async () => {
    setupGuestUser({ turns: 5 });

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "vl_guest_id=existing-guest-uuid",
      },
      body: JSON.stringify({
        history: [{ role: "assistant", content: "こんにちは" }],
        message: "今日は疲れました",
        locale: "ja",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("TURN_LIMIT_EXCEEDED");
  });
});
