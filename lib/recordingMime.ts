/**
 * ブラウザごとにサポートされる MediaRecorder 用 MIME タイプを優先順で選択する。
 *
 * Chrome → `audio/webm;codecs=opus`
 * Firefox → `audio/webm` / `audio/ogg`
 * Safari（iOS / macOS）→ `audio/mp4`
 *
 * Whisper / Claude / ElevenLabs のいずれも webm/opus / mp4 / ogg を受け付けるため、
 * この優先順で最初にサポートされるものを採用する。
 */

// 優先順位は「圧縮効率と互換性の両立」を狙った順。
// 1. webm/opus：Chrome / Firefox / Edge。圧縮効率が最も良い
// 2. webm（コーデック省略）：Firefox の一部で opus 明示がはじかれるケースの保険
// 3. mp4：Safari 系（AAC / MP4 以外は拒否される）
// 4. ogg：レガシー Firefox / Linux の保険
export const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
] as const;

export type SupportedMimeType = (typeof PREFERRED_MIME_TYPES)[number];

/**
 * 任意の判定関数を受け取って、優先順にサポート判定し最初にヒットしたものを返す。
 * Node（Vitest）でモック可能なよう副作用を分離してある。
 *
 * @param isSupported MIME タイプを渡すと対応可否を返す関数（通常は `MediaRecorder.isTypeSupported`）
 * @returns サポートされた MIME タイプ。どれもサポートされない場合は null
 */
export function pickSupportedMimeType(
  isSupported: (mime: string) => boolean
): SupportedMimeType | null {
  for (const mime of PREFERRED_MIME_TYPES) {
    if (isSupported(mime)) return mime;
  }
  return null;
}

/**
 * ブラウザランタイム上で `MediaRecorder.isTypeSupported` を使って選択する薄いラッパー。
 * SSR / Node 実行時は `MediaRecorder` が undefined のため null を返す。
 */
export function pickBrowserMimeType(): SupportedMimeType | null {
  if (typeof MediaRecorder === "undefined") return null;
  return pickSupportedMimeType((mime) => MediaRecorder.isTypeSupported(mime));
}

/**
 * `navigator.mediaDevices.getUserMedia` の rejection を日本語メッセージに変換する。
 *
 * 仕様上の代表的な DOMException 名：
 * - `NotAllowedError`：ユーザーが許可ダイアログで拒否した、またはブラウザ設定で恒久的にブロックしている
 * - `NotFoundError`：該当するデバイスが存在しない（例：マイク未接続）
 * - `NotReadableError`：OS レベルで他アプリがデバイスを占有している
 * - `SecurityError`：HTTPS でない等の安全でないコンテキスト
 * - その他：ハードウェア故障・ブラウザバグ等
 *
 * 純粋関数として切り出し、Vitest でエラー名の分岐を単体検証可能にする。
 */
export function mapGetUserMediaError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
      return "マイクへのアクセスが許可されていません";
    case "NotFoundError":
      return "マイクが見つかりません";
    case "NotReadableError":
      return "他のアプリがマイクを使用中です";
    case "SecurityError":
      return "セキュアな接続（HTTPS）が必要です";
    default:
      return "マイクの取得に失敗しました";
  }
}
