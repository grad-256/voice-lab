import { describe, expect, it } from "vitest";
import { buildDiarySystemPrompt, buildSystemPrompt, parseClaudeResponse } from "./chat";

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

  it("locale=en では translation を null 固定にする指示になる", () => {
    const result = buildSystemPrompt("You are Emma.", "intermediate", "en");
    expect(result).toContain('"translation": null');
    expect(result).not.toContain("Japanese translation of your reply");
  });

  it("locale=ja では日本語訳を要求する指示が維持される", () => {
    const result = buildSystemPrompt("You are Emma.", "intermediate", "ja");
    expect(result).toContain("Japanese translation of your reply");
  });
});

// -------------------------------------------------------
// buildDiarySystemPrompt
// -------------------------------------------------------
describe("buildDiarySystemPrompt", () => {
  it("locale 未指定時は日本語オープナーの挨拶指示になる", () => {
    const result = buildDiarySystemPrompt();
    expect(result).toContain("greet the user casually in Japanese");
    expect(result).toContain("今日どうだった？");
  });

  it("locale=en では英語オープナーの挨拶指示になる", () => {
    const result = buildDiarySystemPrompt({ locale: "en" });
    expect(result).toContain("greet the user casually in English");
    expect(result).toContain("How was your day?");
    expect(result).not.toContain("今日どうだった？");
  });

  it("pastSummaries を渡すと RECENT DIARY CONTEXT 節が追加される", () => {
    const result = buildDiarySystemPrompt({
      pastSummaries: ["昨日は忙しかった", "一昨日は休日"],
    });
    expect(result).toContain("RECENT DIARY CONTEXT");
    expect(result).toContain("[1] 昨日は忙しかった");
    expect(result).toContain("[2] 一昨日は休日");
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
