import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// -------------------------------------------------------
// POST /api/transcribe — インテグレーションテスト
//
// 外部 API（OpenAI Whisper）を fetch モックで代替し、
// ブラウザ別の音声フォーマット対応・エラーハンドリングを検証する
// -------------------------------------------------------

/** ブラウザ別の音声 Blob を生成するヘルパー */
function makeAudioBlob(mimeType: string): Blob {
	return new Blob([new Uint8Array(100)], { type: mimeType });
}

/** FormData に audio をセットした Request を生成するヘルパー */
function makeAudioRequest(blob: Blob): Request {
	const formData = new FormData();
	formData.append("audio", blob);
	return new Request("http://localhost/api/transcribe", {
		method: "POST",
		body: formData,
	});
}

describe("POST /api/transcribe", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("Chrome（webm）の音声を正常に認識してテキストを返す", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ text: "Hello, how are you?" }),
			}),
		);

		const req = makeAudioRequest(makeAudioBlob("audio/webm;codecs=opus"));
		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data.text).toBe("Hello, how are you?");
	});

	it("Safari（mp4）の音声でも正常に認識できる", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ text: "今日はいい天気ですね" }),
			}),
		);

		const req = makeAudioRequest(makeAudioBlob("audio/mp4"));
		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(200);
		expect(data.text).toBe("今日はいい天気ですね");
	});

	it("audio が null のとき 400 を返す", async () => {
		// FormData に audio を含めない
		const formData = new FormData();
		const req = new Request("http://localhost/api/transcribe", {
			method: "POST",
			body: formData,
		});

		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(400);
		expect(data.error).toBeTruthy();
	});

	it("Whisper API がエラーを返したとき日本語エラーメッセージを返す", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				text: () => Promise.resolve("Bad Request"),
			}),
		);

		const req = makeAudioRequest(makeAudioBlob("audio/webm"));
		const res = await POST(req);
		const data = await res.json();

		expect(res.status).toBe(500);
		// エラーメッセージが日本語であること
		expect(data.error).toMatch(/[ぁ-ん]+|[ァ-ン]+|[一-龯]+/);
	});

	it("Whisper API に正しい拡張子でファイルが渡される（Safari → mp4）", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ text: "test" }),
		});
		vi.stubGlobal("fetch", fetchMock);

		const req = makeAudioRequest(makeAudioBlob("audio/mp4"));
		await POST(req);

		// FormData の file フィールドのファイル名を確認
		const sentFormData: FormData = fetchMock.mock.calls[0][1].body;
		const file = sentFormData.get("file") as File;
		expect(file.name).toBe("audio.mp4");
	});
});
