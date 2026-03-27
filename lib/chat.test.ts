import { describe, expect, it } from "vitest";
import { buildSystemPrompt, parseClaudeResponse } from "./chat";

// -------------------------------------------------------
// buildSystemPrompt
// -------------------------------------------------------
describe("buildSystemPrompt", () => {
  it("ベースプロンプトに JSON 返答指示が付加される", () => {
    const result = buildSystemPrompt("You are Emma.");
    expect(result).toContain("You are Emma.");
    expect(result).toContain('"reply"');
    expect(result).toContain('"translation"');
  });

  it("空文字を渡しても JSON 指示だけ含まれる", () => {
    const result = buildSystemPrompt("");
    expect(result).toContain('"reply"');
  });
});

// -------------------------------------------------------
// parseClaudeResponse
// -------------------------------------------------------
describe("parseClaudeResponse", () => {
  it("正常な JSON をパースできる", () => {
    const raw = '{"reply": "Hello!", "translation": "こんにちは！"}';
    const result = parseClaudeResponse(raw);
    expect(result.reply).toBe("Hello!");
    expect(result.translation).toBe("こんにちは！");
  });

  it("コードフェンス付き JSON をパースできる", () => {
    const raw = '```json\n{"reply": "Hi!", "translation": "やあ！"}\n```';
    const result = parseClaudeResponse(raw);
    expect(result.reply).toBe("Hi!");
    expect(result.translation).toBe("やあ！");
  });

  it("translation が省略された場合は null を返す", () => {
    const raw = '{"reply": "Hello!"}';
    const result = parseClaudeResponse(raw);
    expect(result.reply).toBe("Hello!");
    expect(result.translation).toBeNull();
  });

  it("パース不能な文字列はそのまま reply として返す", () => {
    const raw = "これは JSON じゃない";
    const result = parseClaudeResponse(raw);
    expect(result.reply).toBe("これは JSON じゃない");
    expect(result.translation).toBeNull();
  });

  it("reply が省略された場合は raw をフォールバックにする", () => {
    const raw = '{"translation": "翻訳だけ"}';
    const result = parseClaudeResponse(raw);
    // reply キーがないので raw をそのまま返す
    expect(result.reply).toBe(raw);
  });
});
