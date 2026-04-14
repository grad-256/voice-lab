import { describe, expect, it } from "vitest";
import { normalizeEnglish } from "./normalizeEnglish";

describe("normalizeEnglish", () => {
  it("小文字化・前後空白除去・連続空白統合を行う", () => {
    expect(normalizeEnglish("  Hello   World  ")).toBe("hello world");
  });

  it("句読点を除去する", () => {
    expect(normalizeEnglish("Hello, world! Is this OK?")).toBe("hello world is this ok");
  });

  it("縮約形を展開する（基本辞書）", () => {
    expect(normalizeEnglish("I don't know it's fine")).toBe("i do not know it is fine");
    expect(normalizeEnglish("Can't do that")).toBe("can not do that");
  });

  it("縮約形の拡張辞書（Sprint 4）", () => {
    expect(normalizeEnglish("I shouldn't have said that")).toBe("i should not have said that");
    expect(normalizeEnglish("He's here")).toBe("he is here");
    expect(normalizeEnglish("What's your name?")).toBe("what is your name");
    expect(normalizeEnglish("You've got it")).toBe("you have got it");
    expect(normalizeEnglish("You'll see")).toBe("you will see");
  });

  it("ユニコードのアポストロフィも縮約形辞書に到達する", () => {
    expect(normalizeEnglish("I can\u2019t do that")).toBe("i can not do that");
    expect(normalizeEnglish("It\u2019s fine")).toBe("it is fine");
  });

  it("ユニコードのダブルクオートを半角に統一する", () => {
    expect(normalizeEnglish("\u201Chello\u201D")).toBe("hello");
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

  it("保存時と突合時で同一の英文は同一の正規化結果になる（突合の成立条件）", () => {
    // 入力の揺れがあっても同じ結果になることを担保
    const a = normalizeEnglish("  I don't  know.  ");
    const b = normalizeEnglish("I Don\u2019t KNOW!");
    expect(a).toBe(b);
    expect(a).toBe("i do not know");
  });
});
