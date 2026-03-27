import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// -------------------------------------------------------
// POST /api/speak — インテグレーションテスト
//
// 外部 API（ElevenLabs）を fetch モックで代替し、
// 音声バイナリ返却・ボイス ID 解決・エラーハンドリングを検証する
// -------------------------------------------------------

/** ダミーの音声 ArrayBuffer を返す fetch モックを生成するヘルパー */
function mockElevenLabsSuccess() {
	const fakeAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer; // MP3 ヘッダー風
	return vi.fn().mockResolvedValue({
		ok: true,
		arrayBuffer: () => Promise.resolve(fakeAudio),
	});
}

describe("POST /api/speak", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("正常なテキストで audio/mpeg バイナリを返す", async () => {
		vi.stubGlobal("fetch", mockElevenLabsSuccess());

		const req = new Request("http://localhost/api/speak", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "Hello, nice to meet you!" }),
		});

		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
		// キャッシュ無効化ヘッダーが設定されていること
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("text が空のとき 400 を返す", async () => {
		const req = new Request("http://localhost/api/speak", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "" }),
		});

		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.error).toBeTruthy();
	});

	it("ElevenLabs API がエラーを返したとき日本語エラーメッセージを返す", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				text: () => Promise.resolve("Unauthorized"),
			}),
		);

		const req = new Request("http://localhost/api/speak", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "Hello" }),
		});

		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(500);
		// エラーメッセージが日本語であること
		expect(data.error).toMatch(/[ぁ-ん]+|[ァ-ン]+|[一-龯]+/);
	});

	it("voiceId を指定したとき ElevenLabs URL に反映される", async () => {
		const fetchMock = mockElevenLabsSuccess();
		vi.stubGlobal("fetch", fetchMock);

		const customVoiceId = "custom-voice-123";
		const req = new Request("http://localhost/api/speak", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "Hello", voiceId: customVoiceId }),
		});

		await POST(req);

		const calledUrl: string = fetchMock.mock.calls[0][0];
		expect(calledUrl).toContain(customVoiceId);
	});

	it("voiceId を省略したとき環境変数のボイス ID が使われる", async () => {
		const fetchMock = mockElevenLabsSuccess();
		vi.stubGlobal("fetch", fetchMock);

		const req = new Request("http://localhost/api/speak", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: "Hello" }),
		});

		await POST(req);

		// vitest.setup.ts で設定したダミーボイス ID が使われていること
		const calledUrl: string = fetchMock.mock.calls[0][0];
		expect(calledUrl).toContain("test-voice-id");
	});
});
