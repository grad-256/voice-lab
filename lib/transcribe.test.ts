import { describe, expect, it } from "vitest";
import { getMimeExtension } from "./transcribe";

// -------------------------------------------------------
// getMimeExtension
// ブラウザ別の音声フォーマット対応をテスト
// -------------------------------------------------------
describe("getMimeExtension", () => {
  it("Chrome: audio/webm;codecs=opus → webm", () => {
    expect(getMimeExtension("audio/webm;codecs=opus")).toBe("webm");
  });

  it("Chrome: audio/webm → webm", () => {
    expect(getMimeExtension("audio/webm")).toBe("webm");
  });

  it("Safari: audio/mp4 → mp4", () => {
    expect(getMimeExtension("audio/mp4")).toBe("mp4");
  });

  it("Firefox: audio/ogg → ogg", () => {
    expect(getMimeExtension("audio/ogg")).toBe("ogg");
  });

  it("不明な MIME タイプはデフォルト webm", () => {
    expect(getMimeExtension("audio/unknown")).toBe("webm");
  });

  it("空文字はデフォルト webm", () => {
    expect(getMimeExtension("")).toBe("webm");
  });
});
