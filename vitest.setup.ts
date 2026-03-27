import { beforeEach, vi } from "vitest";

/**
 * インテグレーションテスト用セットアップ
 *
 * 実際の API キーは不要。ダミー値を設定することで
 * route.ts 内の `process.env.XXX ?? ""` が空にならないようにする。
 */
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
process.env.ELEVENLABS_VOICE_ID = "test-voice-id";

// 各テストの前に fetch モックをリセット（テスト間の干渉を防ぐ）
beforeEach(() => {
	vi.restoreAllMocks();
});
