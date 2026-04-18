import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { anthropicEndpoint, isGatewayEnabled, openaiEndpoint } from "./aiGateway";

describe("aiGateway", () => {
  const originalAccountId = process.env.CF_ACCOUNT_ID;
  const originalGateway = process.env.CF_AI_GATEWAY_NAME;

  beforeEach(() => {
    // テスト実行環境は Node.js (vitest) のため、process.env から素直に外す。
    // biome の performance ルールは大量削除でヒューリスティックに反応するが、
    // 2 変数の単発削除は問題ないので ignore する。
    // biome-ignore lint/performance/noDelete: テストごとに env 変数をクリーンな状態に戻すため
    delete process.env.CF_ACCOUNT_ID;
    // biome-ignore lint/performance/noDelete: テストごとに env 変数をクリーンな状態に戻すため
    delete process.env.CF_AI_GATEWAY_NAME;
  });

  afterEach(() => {
    if (originalAccountId === undefined) {
      // biome-ignore lint/performance/noDelete: 元々未定義だった env 変数を復元するため
      delete process.env.CF_ACCOUNT_ID;
    } else {
      process.env.CF_ACCOUNT_ID = originalAccountId;
    }
    if (originalGateway === undefined) {
      // biome-ignore lint/performance/noDelete: 元々未定義だった env 変数を復元するため
      delete process.env.CF_AI_GATEWAY_NAME;
    } else {
      process.env.CF_AI_GATEWAY_NAME = originalGateway;
    }
  });

  describe("fallback (env vars not set)", () => {
    it("returns direct OpenAI URL", () => {
      expect(openaiEndpoint("audio/transcriptions")).toBe(
        "https://api.openai.com/v1/audio/transcriptions"
      );
      expect(openaiEndpoint("chat/completions")).toBe("https://api.openai.com/v1/chat/completions");
    });

    it("returns direct Anthropic URL", () => {
      expect(anthropicEndpoint("messages")).toBe("https://api.anthropic.com/v1/messages");
    });

    it("reports gateway disabled", () => {
      expect(isGatewayEnabled()).toBe(false);
    });
  });

  describe("gateway enabled (both env vars set)", () => {
    beforeEach(() => {
      process.env.CF_ACCOUNT_ID = "abc123";
      process.env.CF_AI_GATEWAY_NAME = "my-voice-lab";
    });

    it("returns gateway OpenAI URL without v1 in the provider path", () => {
      expect(openaiEndpoint("audio/transcriptions")).toBe(
        "https://gateway.ai.cloudflare.com/v1/abc123/my-voice-lab/openai/audio/transcriptions"
      );
    });

    it("returns gateway Anthropic URL with v1 preserved", () => {
      expect(anthropicEndpoint("messages")).toBe(
        "https://gateway.ai.cloudflare.com/v1/abc123/my-voice-lab/anthropic/v1/messages"
      );
    });

    it("reports gateway enabled", () => {
      expect(isGatewayEnabled()).toBe(true);
    });

    it("trims leading slashes from path arguments", () => {
      expect(openaiEndpoint("/audio/transcriptions")).toBe(
        "https://gateway.ai.cloudflare.com/v1/abc123/my-voice-lab/openai/audio/transcriptions"
      );
      expect(anthropicEndpoint("/messages")).toBe(
        "https://gateway.ai.cloudflare.com/v1/abc123/my-voice-lab/anthropic/v1/messages"
      );
    });
  });

  describe("partial env (only one set)", () => {
    it("falls back to direct OpenAI when CF_AI_GATEWAY_NAME is missing", () => {
      process.env.CF_ACCOUNT_ID = "abc123";
      expect(openaiEndpoint("audio/transcriptions")).toBe(
        "https://api.openai.com/v1/audio/transcriptions"
      );
      expect(isGatewayEnabled()).toBe(false);
    });

    it("falls back to direct Anthropic when CF_ACCOUNT_ID is missing", () => {
      process.env.CF_AI_GATEWAY_NAME = "my-voice-lab";
      expect(anthropicEndpoint("messages")).toBe("https://api.anthropic.com/v1/messages");
      expect(isGatewayEnabled()).toBe(false);
    });
  });
});
