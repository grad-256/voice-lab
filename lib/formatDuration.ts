// 再生時間・録音経過を表示文字列にするユーティリティ。
// Chapter 系譜の AudioPlayer（秒）と録音中の MONO ラベル（ミリ秒）で共有する。

// 秒数を `m:ss` 形式に（分は padding なし、秒はゼロ埋め）。
// NaN や負数は "0:00" にフォールバック。AudioPlayer など再生時間の表示で使う。
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ミリ秒を `mm:ss` 形式に（分・秒ともゼロ埋め）。録音経過表示など MONO ラベルで使う。
// 負数は 0 にクランプ。
export function formatElapsedMs(ms: number): string {
  const clamped = ms < 0 ? 0 : ms;
  const total = Math.floor(clamped / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
