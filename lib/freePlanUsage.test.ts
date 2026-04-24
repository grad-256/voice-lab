import { describe, expect, it } from "vitest";
import { FREE_TURN_LIMIT, checkTurnLimit, parseCookieValue } from "./freePlanUsage";

describe("checkTurnLimit", () => {
  it("usage が null のとき allowed: true を返す（レコード未作成 = 0 ターン）", () => {
    const result = checkTurnLimit(null);
    expect(result).toEqual({ allowed: true });
  });

  it("turns が上限未満のとき allowed: true を返す", () => {
    const result = checkTurnLimit({ turns: FREE_TURN_LIMIT - 1 });
    expect(result).toEqual({ allowed: true });
  });

  it("turns が上限に達したとき TURN_LIMIT_EXCEEDED を返す", () => {
    const result = checkTurnLimit({ turns: FREE_TURN_LIMIT });
    expect(result).toEqual({ allowed: false, reason: "TURN_LIMIT_EXCEEDED" });
  });

  it("turns が上限を超えているとき TURN_LIMIT_EXCEEDED を返す", () => {
    const result = checkTurnLimit({ turns: FREE_TURN_LIMIT + 10 });
    expect(result).toEqual({ allowed: false, reason: "TURN_LIMIT_EXCEEDED" });
  });
});

describe("parseCookieValue", () => {
  it("cookieHeader が null のとき null を返す", () => {
    const result = parseCookieValue(null, "vl_guest_id");
    expect(result).toBeNull();
  });

  it("指定したクッキー名が存在するとき値を返す", () => {
    const header = "vl_guest_id=abc-123; other=xyz";
    const result = parseCookieValue(header, "vl_guest_id");
    expect(result).toBe("abc-123");
  });

  it("指定したクッキー名が存在しないとき null を返す", () => {
    const header = "other=xyz; another=foo";
    const result = parseCookieValue(header, "vl_guest_id");
    expect(result).toBeNull();
  });

  it("UUID 形式の値を正しく取得できる", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const header = `session=abc; vl_guest_id=${uuid}; lang=ja`;
    const result = parseCookieValue(header, "vl_guest_id");
    expect(result).toBe(uuid);
  });

  it("クッキーが先頭にある場合も正しく取得できる", () => {
    const header = "vl_guest_id=first-value; session=abc";
    const result = parseCookieValue(header, "vl_guest_id");
    expect(result).toBe("first-value");
  });
});
