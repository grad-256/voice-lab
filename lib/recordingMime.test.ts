import { describe, expect, it } from "vitest";
import {
  PREFERRED_MIME_TYPES,
  type SupportedMimeType,
  mapGetUserMediaError,
  pickSupportedMimeType,
} from "./recordingMime";

describe("pickSupportedMimeType", () => {
  // 疑似 isSupported：サポート対象セットを渡すと判定関数を返す
  function makeIsSupported(supported: readonly string[]): (mime: string) => boolean {
    const set = new Set(supported);
    return (mime) => set.has(mime);
  }

  it("Chrome 相当（全て対応）は webm/opus を返す", () => {
    const isSupported = makeIsSupported([
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
    ]);
    expect(pickSupportedMimeType(isSupported)).toBe("audio/webm;codecs=opus");
  });

  it("Firefox 相当（opus 明示が未対応）は audio/webm を返す", () => {
    // Firefox の一部バージョンは codecs パラメータ付きで false を返すケースがある想定
    const isSupported = makeIsSupported(["audio/webm", "audio/ogg"]);
    expect(pickSupportedMimeType(isSupported)).toBe("audio/webm");
  });

  it("Safari 相当（webm 系非対応）は audio/mp4 を返す", () => {
    const isSupported = makeIsSupported(["audio/mp4"]);
    expect(pickSupportedMimeType(isSupported)).toBe("audio/mp4");
  });

  it("webm / mp4 が未対応でも ogg があれば audio/ogg を返す（レガシー Firefox 想定）", () => {
    const isSupported = makeIsSupported(["audio/ogg"]);
    expect(pickSupportedMimeType(isSupported)).toBe("audio/ogg");
  });

  it("どれもサポートされていなければ null を返す", () => {
    const isSupported = makeIsSupported([]);
    expect(pickSupportedMimeType(isSupported)).toBeNull();
  });

  it("優先順位は PREFERRED_MIME_TYPES の並び通り（webm/opus > webm > mp4 > ogg）", () => {
    // mp4 と ogg だけが対応のケースでは mp4 が優先される
    const isSupported = makeIsSupported(["audio/mp4", "audio/ogg"]);
    expect(pickSupportedMimeType(isSupported)).toBe("audio/mp4");
  });

  it("無関係な MIME を true にする判定器でも優先リストに無いものは返さない", () => {
    // Safari が "audio/aac" を true にしてもリスト外は選ばない
    const isSupported = (mime: string): boolean => mime === "audio/aac" || mime === "audio/ogg";
    expect(pickSupportedMimeType(isSupported)).toBe("audio/ogg");
  });

  it("PREFERRED_MIME_TYPES は 4 種・順序固定（レグレッションガード）", () => {
    const expected: SupportedMimeType[] = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
    ];
    expect([...PREFERRED_MIME_TYPES]).toEqual(expected);
  });
});

describe("mapGetUserMediaError", () => {
  // DOMException を直接作れない環境向けの Error サブクラス
  class NamedError extends Error {
    constructor(name: string) {
      super(name);
      this.name = name;
    }
  }

  it("NotAllowedError（許可拒否）は「許可されていません」文言を返す", () => {
    expect(mapGetUserMediaError(new NamedError("NotAllowedError"))).toBe(
      "マイクへのアクセスが許可されていません"
    );
  });

  it("NotFoundError（マイク未接続）は「マイクが見つかりません」文言を返す", () => {
    expect(mapGetUserMediaError(new NamedError("NotFoundError"))).toBe("マイクが見つかりません");
  });

  it("NotReadableError（他アプリ占有）は「他のアプリがマイクを使用中です」文言を返す", () => {
    expect(mapGetUserMediaError(new NamedError("NotReadableError"))).toBe(
      "他のアプリがマイクを使用中です"
    );
  });

  it("SecurityError（非 HTTPS）は「セキュアな接続（HTTPS）が必要です」文言を返す", () => {
    expect(mapGetUserMediaError(new NamedError("SecurityError"))).toBe(
      "セキュアな接続（HTTPS）が必要です"
    );
  });

  it("未知のエラー名は汎用文言（マイクの取得に失敗しました）にフォールバック", () => {
    expect(mapGetUserMediaError(new NamedError("AbortError"))).toBe("マイクの取得に失敗しました");
  });

  it("Error インスタンスでない値（string・undefined 等）も汎用文言にフォールバック", () => {
    expect(mapGetUserMediaError("NotAllowedError")).toBe("マイクの取得に失敗しました");
    expect(mapGetUserMediaError(undefined)).toBe("マイクの取得に失敗しました");
    expect(mapGetUserMediaError(null)).toBe("マイクの取得に失敗しました");
  });
});
