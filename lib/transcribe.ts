/**
 * transcribe ルートの純粋関数
 * MIME タイプから Whisper に渡すファイル拡張子を決定する
 */

// ブラウザ別の音声フォーマット対応表
// Chrome  → audio/webm;codecs=opus → webm
// Safari  → audio/mp4              → mp4
// Firefox → audio/ogg              → ogg
export function getMimeExtension(mimeType: string): "mp4" | "ogg" | "webm" {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm"; // デフォルト（Chrome / 不明）
}
