import { describe, expect, it } from "vitest";
import {
  buildFallbackPhrases,
  buildSuggestSystemPrompt,
  buildSuggestUserContent,
  normalizeEnglish,
  parseSuggestResponse,
  toSuggestPhrases,
} from "./suggest";

// -------------------------------------------------------
// normalizeEnglish
// mvp-scope.md 4.5 節の正規化ルールを満たすか
// -------------------------------------------------------

describe("normalizeEnglish", () => {
  it("小文字化・前後空白除去・連続空白統合を行う", () => {
    expect(normalizeEnglish("  Hello   World  ")).toBe("hello world");
  });

  it("句読点を除去する", () => {
    expect(normalizeEnglish("Hello, world! Is this OK?")).toBe("hello world is this ok");
  });

  it("縮約形を展開する（最小辞書）", () => {
    expect(normalizeEnglish("I don't know it's fine")).toBe("i do not know it is fine");
    expect(normalizeEnglish("Can't do that")).toBe("can not do that");
  });

  it("ユニコードのアポストロフィも縮約形辞書に到達する", () => {
    expect(normalizeEnglish("I can\u2019t do that")).toBe("i can not do that");
  });

  it("全角英数・全角スペースを半角に統一する", () => {
    expect(normalizeEnglish("Ｈｅｌｌｏ　world")).toBe("hello world");
  });

  it("非文字列入力は空文字列を返す（防御）", () => {
    // @ts-expect-error 実行時防御の確認
    expect(normalizeEnglish(null)).toBe("");
    // @ts-expect-error 実行時防御の確認
    expect(normalizeEnglish(undefined)).toBe("");
  });
});

// -------------------------------------------------------
// parseSuggestResponse
// Claude 応答のバリエーションに耐えるか
// -------------------------------------------------------

describe("parseSuggestResponse", () => {
  it("素直な JSON をパースする", () => {
    const raw = '{"phrases":[{"ja_intent":"挨拶","en_text":"Hello there."}]}';
    expect(parseSuggestResponse(raw)).toEqual([{ ja_intent: "挨拶", en_text: "Hello there." }]);
  });

  it("コードフェンス付き JSON を抽出する", () => {
    const raw = '```json\n{"phrases":[{"ja_intent":"質問","en_text":"What is this?"}]}\n```';
    expect(parseSuggestResponse(raw)).toEqual([{ ja_intent: "質問", en_text: "What is this?" }]);
  });

  it("最大 3 件までに切り詰める", () => {
    const raw = JSON.stringify({
      phrases: [
        { ja_intent: "a", en_text: "A." },
        { ja_intent: "b", en_text: "B." },
        { ja_intent: "c", en_text: "C." },
        { ja_intent: "d", en_text: "D." },
      ],
    });
    expect(parseSuggestResponse(raw)).toHaveLength(3);
  });

  it("en_text が空のエントリは除外する", () => {
    const raw = JSON.stringify({
      phrases: [
        { ja_intent: "valid", en_text: "OK" },
        { ja_intent: "empty", en_text: "" },
      ],
    });
    expect(parseSuggestResponse(raw)).toEqual([{ ja_intent: "valid", en_text: "OK" }]);
  });

  it("完全に壊れた応答では空配列を返す", () => {
    expect(parseSuggestResponse("not json at all")).toEqual([]);
    expect(parseSuggestResponse("")).toEqual([]);
  });
});

// -------------------------------------------------------
// buildFallbackPhrases
// ルールベースフォールバックが 3 件返るか
// -------------------------------------------------------

describe("buildFallbackPhrases", () => {
  it("3 件のフォールバックを返す", () => {
    const phrases = buildFallbackPhrases();
    expect(phrases).toHaveLength(3);
    for (const p of phrases) {
      expect(p.en_text.length).toBeGreaterThan(0);
      expect(p.ja_intent.length).toBeGreaterThan(0);
    }
  });

  it("呼び出し元が破壊的に書き換えても次の呼び出しに影響しない", () => {
    const first = buildFallbackPhrases();
    first[0].en_text = "MUTATED";
    const second = buildFallbackPhrases();
    expect(second[0].en_text).not.toBe("MUTATED");
  });
});

// -------------------------------------------------------
// toSuggestPhrases
// phrase_id 発行と正規化テキスト付与
// -------------------------------------------------------

describe("toSuggestPhrases", () => {
  it("phrase_id と en_text_normalized を付与する", () => {
    let counter = 0;
    const generateId = () => `id-${++counter}`;
    const out = toSuggestPhrases(
      [
        { ja_intent: "A", en_text: "Hello, World!" },
        { ja_intent: "B", en_text: "It's fine." },
      ],
      generateId
    );
    expect(out).toEqual([
      {
        phrase_id: "id-1",
        ja_intent: "A",
        en_text: "Hello, World!",
        en_text_normalized: "hello world",
      },
      {
        phrase_id: "id-2",
        ja_intent: "B",
        en_text: "It's fine.",
        en_text_normalized: "it is fine",
      },
    ]);
  });

  it("4 件以上入力されても 3 件に切り詰める", () => {
    const out = toSuggestPhrases(
      [
        { ja_intent: "a", en_text: "A." },
        { ja_intent: "b", en_text: "B." },
        { ja_intent: "c", en_text: "C." },
        { ja_intent: "d", en_text: "D." },
      ],
      () => "x"
    );
    expect(out).toHaveLength(3);
  });
});

// -------------------------------------------------------
// buildSuggestSystemPrompt
// JSON 指示が必ず入っているか
// -------------------------------------------------------

describe("buildSuggestSystemPrompt", () => {
  it("JSON 出力指示と phrases キーを含む（デフォルト）", () => {
    const prompt = buildSuggestSystemPrompt();
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("phrases");
    expect(prompt).toContain("ja_intent");
    expect(prompt).toContain("en_text");
  });

  it("timing に応じて文脈が切り替わる", () => {
    const before = buildSuggestSystemPrompt("before_chat");
    const during = buildSuggestSystemPrompt("during_chat");
    expect(before).toContain("BEFORE a conversation");
    expect(during).toContain("continue an ongoing conversation");
    // 共通要素
    expect(before).toContain("phrases");
    expect(during).toContain("phrases");
  });
});

// -------------------------------------------------------
// buildSuggestUserContent
// Sprint 4：recent_messages / timing / persona_id の組み立て
// -------------------------------------------------------

describe("buildSuggestUserContent", () => {
  it("ja_text 単独でも成立する（Sprint 3 互換）", () => {
    const out = buildSuggestUserContent({ jaText: "こんにちは" });
    expect(out).toContain("Japanese utterance:");
    expect(out).toContain("こんにちは");
  });

  it("persona_id を先頭セクションに入れる", () => {
    const out = buildSuggestUserContent({ jaText: "yo", personaId: "p-123" });
    expect(out).toContain("Persona hint: p-123");
  });

  it("recent_messages は末尾 6 件に絞り、各メッセージ 200 文字で切り詰める", () => {
    const long = "x".repeat(500);
    const recent = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: i === 9 ? long : `msg-${i}`,
    }));
    const out = buildSuggestUserContent({ jaText: "hello", recentMessages: recent });
    // msg-0〜msg-3 は落ちる、msg-4〜msg-8 と long が残る（末尾 6 件）
    expect(out).not.toContain("msg-0");
    expect(out).toContain("msg-4");
    expect(out).toContain("msg-8");
    // 500 文字は 200 に切り詰められる
    expect(out).not.toContain("x".repeat(201));
  });

  it("timing=before_chat では開始前のヒントが入る（ja_text 無しでも OK）", () => {
    const out = buildSuggestUserContent({ jaText: "", timing: "before_chat" });
    expect(out).toContain("about to start");
  });

  it("timing=during_chat では直後発話のヒントが入る", () => {
    const out = buildSuggestUserContent({ jaText: "", timing: "during_chat" });
    expect(out).toContain("next line");
  });
});
