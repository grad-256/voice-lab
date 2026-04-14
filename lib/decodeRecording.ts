/**
 * 録音 Blob を AudioBuffer にデコードし、特徴量計算用のモノラル波形を取り出す。
 *
 * Web Audio API（AudioContext.decodeAudioData）に依存するためブラウザ専用。
 * Vitest からは呼ばないこと（純粋ロジックは `audioFeatures.ts` にある）。
 *
 * @returns モノラル Float32 サンプルとサンプルレート（Hz）
 * @throws decodeAudioData 失敗時（壊れた音声・未対応コーデック）
 */
export async function decodeRecordingToMono(
  blob: Blob
): Promise<{ samples: Float32Array; sampleRate: number }> {
  // Safari 旧版は webkitAudioContext しか持たない
  const Ctor: typeof AudioContext =
    typeof window !== "undefined" && window.AudioContext
      ? window.AudioContext
      : (window as unknown as { webkitAudioContext: typeof AudioContext })?.webkitAudioContext;

  if (!Ctor) {
    throw new Error("このブラウザは音声デコードに対応していません");
  }

  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new Ctor();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel0 = audioBuffer.getChannelData(0);
    // AudioContext.close 後も触れるよう、所有権のあるコピーを返す
    const samples = new Float32Array(channel0.length);
    samples.set(channel0);
    return { samples, sampleRate: audioBuffer.sampleRate };
  } finally {
    try {
      await ctx.close();
    } catch {
      // 一部ブラウザは close 不可。リーク許容（ページ遷移時に GC される）
    }
  }
}
