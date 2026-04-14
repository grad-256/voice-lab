import { describe, expect, it } from "vitest";
import {
  PLAYED_PHRASE_TTL_MS,
  type PlayedPhrase,
  matchPlayedPhrase,
  pruneExpired,
  pushPlayedPhrase,
} from "./playedPhraseHistory";

const NOW = 1_700_000_000_000;

function phrase(overrides: Partial<PlayedPhrase> = {}): PlayedPhrase {
  return {
    phrase_id: "p1",
    en_text_normalized: "hello",
    source: "suggest",
    played_at: NOW,
    ...overrides,
  };
}

describe("pushPlayedPhrase", () => {
  it("新規エントリを追加する（正規化テキストを付与）", () => {
    const out = pushPlayedPhrase([], {
      phrase_id: "p1",
      en_text: "Hello, world!",
      source: "suggest",
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0].phrase_id).toBe("p1");
    expect(out[0].en_text_normalized).toBe("hello world");
    expect(out[0].source).toBe("suggest");
    expect(out[0].played_at).toBe(NOW);
  });

  it("同一 phrase_id は最新で上書きする", () => {
    const existing: PlayedPhrase[] = [
      phrase({ phrase_id: "p1", played_at: NOW - 1000, en_text_normalized: "hello" }),
    ];
    const out = pushPlayedPhrase(existing, {
      phrase_id: "p1",
      en_text: "Hello again",
      source: "suggest",
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0].en_text_normalized).toBe("hello again");
    expect(out[0].played_at).toBe(NOW);
  });

  it("TTL 超過エントリを prune してから追加する", () => {
    const old = phrase({
      phrase_id: "p-old",
      played_at: NOW - PLAYED_PHRASE_TTL_MS - 1,
    });
    const fresh = phrase({ phrase_id: "p-fresh", played_at: NOW - 1000 });
    const out = pushPlayedPhrase([old, fresh], {
      phrase_id: "p-new",
      en_text: "New",
      source: "suggest",
      now: NOW,
    });
    expect(out.map((p) => p.phrase_id)).toEqual(["p-fresh", "p-new"]);
  });

  it("50 件を超える場合は古いものから切り捨てる", () => {
    const many: PlayedPhrase[] = Array.from({ length: 55 }, (_, i) =>
      phrase({
        phrase_id: `p${i}`,
        played_at: NOW - (55 - i) * 1000,
        en_text_normalized: `t${i}`,
      })
    );
    const out = pushPlayedPhrase(many, {
      phrase_id: "new",
      en_text: "new",
      source: "suggest",
      now: NOW,
    });
    expect(out.length).toBe(50);
    // 先頭（最古）の p0 は落ちる、末尾は "new"
    expect(out.find((p) => p.phrase_id === "p0")).toBeUndefined();
    expect(out[out.length - 1].phrase_id).toBe("new");
  });
});

describe("pruneExpired", () => {
  it("TTL 切れを落とす", () => {
    const list: PlayedPhrase[] = [
      phrase({ phrase_id: "old", played_at: NOW - PLAYED_PHRASE_TTL_MS - 1 }),
      phrase({ phrase_id: "new", played_at: NOW - 1000 }),
    ];
    expect(pruneExpired(list, NOW).map((p) => p.phrase_id)).toEqual(["new"]);
  });

  it("型不正エントリを落とす", () => {
    const list = [
      null,
      { phrase_id: 123 },
      phrase({ phrase_id: "ok" }),
      { phrase_id: "bad", source: "invalid", played_at: NOW, en_text_normalized: "x" },
    ] as unknown as PlayedPhrase[];
    expect(pruneExpired(list, NOW).map((p) => p.phrase_id)).toEqual(["ok"]);
  });
});

describe("matchPlayedPhrase", () => {
  it("prefilledPhraseId が履歴にあれば id 突合する", () => {
    const history = [phrase({ phrase_id: "p1", en_text_normalized: "bye" })];
    const out = matchPlayedPhrase("something else", history, {
      prefilledPhraseId: "p1",
      now: NOW,
    });
    expect(out).toEqual({ phrase_id: "p1", source: "suggest", match_strategy: "id" });
  });

  it("prefilledPhraseId が履歴に無ければテキスト一致にフォールバック", () => {
    const history = [phrase({ phrase_id: "p1", en_text_normalized: "hello world" })];
    const out = matchPlayedPhrase("Hello, world!", history, {
      prefilledPhraseId: "not-in-history",
      now: NOW,
    });
    expect(out?.match_strategy).toBe("normalized_text");
    expect(out?.phrase_id).toBe("p1");
  });

  it("正規化テキスト一致で複数候補があれば最新を選ぶ", () => {
    const history: PlayedPhrase[] = [
      phrase({
        phrase_id: "older",
        en_text_normalized: "good morning",
        played_at: NOW - 10_000,
      }),
      phrase({
        phrase_id: "newer",
        en_text_normalized: "good morning",
        played_at: NOW - 1_000,
      }),
    ];
    const out = matchPlayedPhrase("Good morning.", history, { now: NOW });
    expect(out?.phrase_id).toBe("newer");
    expect(out?.match_strategy).toBe("normalized_text");
  });

  it("TTL 切れのエントリは突合対象外", () => {
    const history = [
      phrase({
        phrase_id: "expired",
        en_text_normalized: "hello",
        played_at: NOW - PLAYED_PHRASE_TTL_MS - 1,
      }),
    ];
    expect(matchPlayedPhrase("hello", history, { now: NOW })).toBeNull();
    // prefilled でも TTL 切れは除外される
    expect(
      matchPlayedPhrase("hello", history, { prefilledPhraseId: "expired", now: NOW })
    ).toBeNull();
  });

  it("ユーザーテキストが空なら null を返す", () => {
    const history = [phrase()];
    expect(matchPlayedPhrase("   ", history, { now: NOW })).toBeNull();
  });

  it("履歴が空なら null を返す", () => {
    expect(matchPlayedPhrase("hello", [], { now: NOW })).toBeNull();
  });

  it("縮約形の差異でも正規化で一致する（突合の成立条件）", () => {
    const history = [phrase({ phrase_id: "p1", en_text_normalized: "i do not know" })];
    const out = matchPlayedPhrase("I don't know.", history, { now: NOW });
    expect(out?.phrase_id).toBe("p1");
  });
});
