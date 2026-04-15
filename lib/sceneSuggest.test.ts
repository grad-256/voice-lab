import { describe, expect, it } from "vitest";
import {
  SCENE_SUGGEST_CACHE_TTL_MS,
  SCENE_SUGGEST_MODEL,
  buildFallbackPhrases,
  buildSceneSuggestSystemPrompt,
  buildSceneSuggestUserContent,
  cacheKeyFor,
  isCacheEntryFresh,
  isSceneCompletedFromPhrases,
  parseSceneSuggestResponse,
  toSceneSuggestedPhrases,
} from "./sceneSuggest";

describe("SCENE_SUGGEST_MODEL", () => {
  it("Sonnet 4.5 を指す（文脈適合を優先する判断）", () => {
    expect(SCENE_SUGGEST_MODEL).toBe("claude-sonnet-4-5");
  });
});

describe("buildSceneSuggestSystemPrompt", () => {
  it("exactly 3 フレーズ / JSON 専用出力 / ja_intent ルールが明示されている", () => {
    const prompt = buildSceneSuggestSystemPrompt();
    expect(prompt).toMatch(/exactly 3 phrases/);
    expect(prompt).toMatch(/ONLY a JSON object/);
    expect(prompt).toMatch(/ja_intent/);
  });
});

describe("buildSceneSuggestUserContent", () => {
  it("必須 3 要素が含まれる", () => {
    const content = buildSceneSuggestUserContent({
      sceneId: "station-directions",
      situationJa: "観光客に道案内を求められた場面",
      emotionJa: "英語が出てこない",
    });
    expect(content).toMatch(/station-directions/);
    expect(content).toMatch(/観光客に道案内/);
    expect(content).toMatch(/英語が出てこない/);
  });

  it("user_context 指定時は文脈に追加される", () => {
    const content = buildSceneSuggestUserContent({
      sceneId: "station-directions",
      situationJa: "道案内",
      emotionJa: "不安",
      userContext: "渋谷駅で原宿への道を聞かれた",
    });
    expect(content).toMatch(/渋谷駅で原宿/);
  });

  it("user_context が空白のみなら含めない", () => {
    const content = buildSceneSuggestUserContent({
      sceneId: "s",
      situationJa: "x",
      emotionJa: "y",
      userContext: "   ",
    });
    expect(content).not.toMatch(/Specific context/);
  });
});

describe("parseSceneSuggestResponse", () => {
  it("直接 JSON をパース", () => {
    const raw = '{"phrases":[{"ja_intent":"挨拶","en_text":"Hi there."}]}';
    const result = parseSceneSuggestResponse(raw);
    expect(result).toEqual([{ ja_intent: "挨拶", en_text: "Hi there." }]);
  });

  it("コードフェンス付きでもパース", () => {
    const raw = '```json\n{"phrases":[{"ja_intent":"x","en_text":"A."}]}\n```';
    const result = parseSceneSuggestResponse(raw);
    expect(result[0].en_text).toBe("A.");
  });

  it("前後に文章が混ざっても { } 抽出で復帰", () => {
    const raw = 'Sure, here is the JSON: {"phrases":[{"ja_intent":"x","en_text":"B."}]}';
    const result = parseSceneSuggestResponse(raw);
    expect(result[0].en_text).toBe("B.");
  });

  it("en_text 空は除外", () => {
    const raw = '{"phrases":[{"ja_intent":"x","en_text":""},{"ja_intent":"y","en_text":"Ok."}]}';
    const result = parseSceneSuggestResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].en_text).toBe("Ok.");
  });

  it("パース不能は空配列", () => {
    expect(parseSceneSuggestResponse("not json at all")).toEqual([]);
    expect(parseSceneSuggestResponse("")).toEqual([]);
  });

  it("最大 3 件に切り詰める", () => {
    const raw = `{"phrases":[
      {"ja_intent":"1","en_text":"A."},
      {"ja_intent":"2","en_text":"B."},
      {"ja_intent":"3","en_text":"C."},
      {"ja_intent":"4","en_text":"D."}
    ]}`;
    expect(parseSceneSuggestResponse(raw)).toHaveLength(3);
  });
});

describe("buildFallbackPhrases", () => {
  it("既知 scene_id には固有フォールバックを返す", () => {
    const phrases = buildFallbackPhrases("checkout");
    expect(phrases[0].en_text).toMatch(/Card/);
    expect(phrases).toHaveLength(3);
  });

  it("未知 scene_id には汎用フォールバック", () => {
    const phrases = buildFallbackPhrases("unknown-scene");
    expect(phrases).toHaveLength(3);
    expect(phrases[0].ja_intent).toBeTruthy();
  });

  it("返り値は immutable（呼び出し元で破壊しても元が壊れない）", () => {
    const p1 = buildFallbackPhrases("restroom");
    p1[0].en_text = "MUTATED";
    const p2 = buildFallbackPhrases("restroom");
    expect(p2[0].en_text).not.toBe("MUTATED");
  });
});

describe("toSceneSuggestedPhrases", () => {
  it("phrase_id と normalized を付与、最大 3 件", () => {
    let n = 0;
    const result = toSceneSuggestedPhrases(
      [
        { ja_intent: "x", en_text: "Hello, world." },
        { ja_intent: "y", en_text: "Good morning." },
        { ja_intent: "z", en_text: "Goodbye." },
        { ja_intent: "w", en_text: "Extra." },
      ],
      () => `id-${++n}`
    );
    expect(result).toHaveLength(3);
    expect(result[0].phrase_id).toBe("id-1");
    expect(result[0].en_text_normalized).toBe("hello world");
    expect(result[1].en_text_normalized).toBe("good morning");
  });
});

describe("cacheKeyFor / isCacheEntryFresh", () => {
  it("キーは scene_id を含む", () => {
    expect(cacheKeyFor("checkout")).toBe("scene-suggest:checkout");
  });

  it("null エントリは fresh でない", () => {
    expect(isCacheEntryFresh(null)).toBe(false);
  });

  it("TTL 内は fresh", () => {
    const now = 1_700_000_000_000;
    const entry = { phrases: [], fallback: false, fetched_at: now - 1000 };
    expect(isCacheEntryFresh(entry, now)).toBe(true);
  });

  it("TTL 超過は fresh でない", () => {
    const now = 1_700_000_000_000;
    const entry = {
      phrases: [],
      fallback: false,
      fetched_at: now - (SCENE_SUGGEST_CACHE_TTL_MS + 1),
    };
    expect(isCacheEntryFresh(entry, now)).toBe(false);
  });

  it("fetched_at が number でないと fresh 扱いしない", () => {
    const entry = {
      phrases: [],
      fallback: false,
      fetched_at: "not-a-number",
    } as unknown as {
      phrases: [];
      fallback: false;
      fetched_at: number;
    };
    expect(isCacheEntryFresh(entry)).toBe(false);
  });
});

describe("isSceneCompletedFromPhrases", () => {
  const phrases = [{ phrase_id: "a" }, { phrase_id: "b" }, { phrase_id: "c" }];

  it("全再生済みで true", () => {
    expect(isSceneCompletedFromPhrases(phrases, new Set(["a", "b", "c"]))).toBe(true);
  });

  it("1 つ欠けで false", () => {
    expect(isSceneCompletedFromPhrases(phrases, new Set(["a", "b"]))).toBe(false);
  });

  it("空 phrases は false（未取得扱い）", () => {
    expect(isSceneCompletedFromPhrases([], new Set(["a"]))).toBe(false);
  });

  it("余分な id が混じっても当該フレーズが揃っていれば true", () => {
    expect(isSceneCompletedFromPhrases(phrases, new Set(["a", "b", "c", "z"]))).toBe(true);
  });
});
