import { describe, expect, it } from "vitest";
import { extractPitchHz } from "./audioFeatures";

// -------------------------------------------------------
// audioFeatures
// 合成波形を入力して F0 推定・外れ値除去・エッジケースを検証する
// -------------------------------------------------------

const SAMPLE_RATE = 44100;

// 指定周波数・長さの純粋正弦波
function generateSine(freqHz: number, durationSec: number, sampleRate: number): Float32Array {
  const length = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = Math.sin(2 * Math.PI * freqHz * (i / sampleRate));
  }
  return out;
}

// 2 つの正弦波を時間方向に連結（オクターブエラー混入のシミュレーション）
function concatSines(
  segments: { freqHz: number; durationSec: number }[],
  sampleRate: number
): Float32Array {
  const parts = segments.map((s) => generateSine(s.freqHz, s.durationSec, sampleRate));
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// FM 変調波（ビブラート模擬）：中心周波数の周りを周期的に揺らす
function generateVibrato(
  centerHz: number,
  modDepthPct: number,
  modRateHz: number,
  durationSec: number,
  sampleRate: number
): Float32Array {
  const length = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(length);
  // 瞬時位相を累積していく（単純な freq * t では変調が正しく表現できないため）
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const instantHz = centerHz * (1 + modDepthPct * Math.sin(2 * Math.PI * modRateHz * t));
    phase += (2 * Math.PI * instantHz) / sampleRate;
    out[i] = Math.sin(phase);
  }
  return out;
}

describe("extractPitchHz", () => {
  function expectWithinTolerance(
    actual: number | null,
    expected: number,
    tolerancePct: number
  ): void {
    expect(actual).not.toBeNull();
    if (actual === null) return;
    const diffPct = Math.abs(actual - expected) / expected;
    expect(diffPct).toBeLessThan(tolerancePct);
  }

  // ---- 基本検出 ----

  it("440Hz（A4）の正弦波を ±3% 以内で検出する", () => {
    const samples = generateSine(440, 1, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expectWithinTolerance(result.pitchHz, 440, 0.03);
    expect(result.voicedFrameCount).toBeGreaterThan(30);
  });

  it("220Hz（A3・男性声域相当）を ±3% 以内で検出する", () => {
    const samples = generateSine(220, 1, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expectWithinTolerance(result.pitchHz, 220, 0.03);
  });

  it("880Hz（A5・女性声域上端相当）を ±3% 以内で検出する", () => {
    const samples = generateSine(880, 1, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expectWithinTolerance(result.pitchHz, 880, 0.03);
  });

  it("48kHz サンプルレートでも 440Hz を検出できる（iOS Safari 想定）", () => {
    const sr = 48000;
    const samples = generateSine(440, 1, sr);
    const result = extractPitchHz(samples, sr);
    expectWithinTolerance(result.pitchHz, 440, 0.03);
  });

  // ---- 外れ値除去（MAD）ロジックの検証 ----

  it("末尾に混入したオクターブエラー相当の波を MAD フィルタが除去する", () => {
    // 前 0.9 秒 440Hz + 末尾 0.1 秒 880Hz。オクターブ誤検出を混入したシミュレーション。
    // フレーム数の大半（約 37/41 ≒ 90%）が 440Hz 周辺のため、中央値は 440Hz 近傍に落ち着く。
    const samples = concatSines(
      [
        { freqHz: 440, durationSec: 0.9 },
        { freqHz: 880, durationSec: 0.1 },
      ],
      SAMPLE_RATE
    );
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expectWithinTolerance(result.pitchHz, 440, 0.05);
  });

  it("単一周波数（MAD=0）でも threshold=0 フォールバックが効いて pitches がそのまま使われる", () => {
    // 完全に単一の正弦波 → 各フレームの推定値がほぼ同値 → MAD ≒ 0
    // threshold > 0 分岐の false 側（`filtered === pitches`）を通る
    const samples = generateSine(440, 2, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expectWithinTolerance(result.pitchHz, 440, 0.03);
    // 2 秒分のフレーム（約 86 フレーム）が採用されていること
    expect(result.voicedFrameCount).toBeGreaterThan(60);
  });

  it("ビブラート（±5% 揺らぎ・5Hz 変調）でも中央値は中心周波数に収束する", () => {
    // 現実の発話は定常正弦波ではなく抑揚があるため、MAD が過剰除去しないかの回帰テスト
    const samples = generateVibrato(440, 0.05, 5, 2, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expectWithinTolerance(result.pitchHz, 440, 0.08);
    expect(result.voicedFrameCount).toBeGreaterThan(40);
  });

  // ---- フレーム境界計算 ----

  it("totalFrames がスライディングウィンドウ式の期待値と一致する", () => {
    // 1 秒（44100 サンプル）、FRAME_SIZE=2048、HOP_SIZE=1024
    // 期待値：floor((44100 - 2048) / 1024) + 1 = 42
    const samples = generateSine(440, 1, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expect(result.totalFrames).toBe(42);
  });

  // ---- エッジケース ----

  it("無音（全ゼロ）入力で null を返す", () => {
    const samples = new Float32Array(SAMPLE_RATE); // 1 秒の無音
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expect(result.pitchHz).toBeNull();
  });

  it("1 フレーム未満の短すぎる入力で null を返す（totalFrames=0）", () => {
    const samples = generateSine(440, 0.01, SAMPLE_RATE); // 441 サンプル < FRAME_SIZE 2048
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expect(result.pitchHz).toBeNull();
    expect(result.totalFrames).toBe(0);
    expect(result.voicedFrameCount).toBe(0);
  });

  it("MIN_VOICED_FRAMES 未満の有声フレームしか取れない入力で null を返す", () => {
    // 0.3 秒の正弦波 → フレーム約 13 枚、MIN_VOICED_FRAMES=30 未満
    const samples = generateSine(440, 0.3, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expect(result.pitchHz).toBeNull();
    expect(result.voicedFrameCount).toBeLessThan(30);
  });

  it("MIN_VOICED_FRAMES をギリギリ超える入力で非 null を返す", () => {
    // 0.8 秒の正弦波 → フレーム約 33 枚、閾値 30 を超える
    const samples = generateSine(440, 0.8, SAMPLE_RATE);
    const result = extractPitchHz(samples, SAMPLE_RATE);
    expect(result.pitchHz).not.toBeNull();
    expectWithinTolerance(result.pitchHz, 440, 0.03);
  });

  it("無効な sampleRate で例外を投げる", () => {
    const samples = new Float32Array(4096);
    expect(() => extractPitchHz(samples, 0)).toThrow();
    expect(() => extractPitchHz(samples, -1)).toThrow();
    expect(() => extractPitchHz(samples, Number.NaN)).toThrow();
  });
});
