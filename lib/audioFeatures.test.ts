import { describe, expect, it } from "vitest";
import { extractLoudnessRms, extractPitchHz, extractSpectralCentroid } from "./audioFeatures";

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

// ---------------------------------------------------------------------------
// extractLoudnessRms
// ---------------------------------------------------------------------------

describe("extractLoudnessRms", () => {
  it("振幅 1.0 の正弦波は RMS ≒ 1/√2 (≒ 0.707) を返す", () => {
    const samples = generateSine(440, 1, SAMPLE_RATE);
    const result = extractLoudnessRms(samples);
    expect(result.rms).toBeGreaterThan(0.7);
    expect(result.rms).toBeLessThan(0.71);
    expect(result.sampleCount).toBe(SAMPLE_RATE);
  });

  it("振幅 0.5 の正弦波は RMS ≒ 0.5/√2 (≒ 0.354) を返す", () => {
    const samples = generateSine(440, 1, SAMPLE_RATE);
    for (let i = 0; i < samples.length; i++) samples[i] *= 0.5;
    const result = extractLoudnessRms(samples);
    expect(result.rms).toBeGreaterThan(0.35);
    expect(result.rms).toBeLessThan(0.36);
  });

  it("rmsDb は 20*log10(rms) と一致する", () => {
    const samples = generateSine(440, 0.5, SAMPLE_RATE);
    const result = extractLoudnessRms(samples);
    expect(result.rmsDb).toBeCloseTo(20 * Math.log10(result.rms), 5);
  });

  it("無音（全ゼロ）は rms=0 / dB=-120（クランプ下限）を返す", () => {
    const samples = new Float32Array(SAMPLE_RATE);
    const result = extractLoudnessRms(samples);
    expect(result.rms).toBe(0);
    expect(result.rmsDb).toBe(-120);
  });

  it("空入力でも例外を投げず rms=0 を返す", () => {
    const result = extractLoudnessRms(new Float32Array(0));
    expect(result.rms).toBe(0);
    expect(result.rmsDb).toBe(-120);
    expect(result.sampleCount).toBe(0);
  });

  it("振幅 2 倍で rms も 2 倍（線形性の確認）", () => {
    const base = generateSine(440, 0.5, SAMPLE_RATE);
    const loud = new Float32Array(base.length);
    for (let i = 0; i < base.length; i++) loud[i] = base[i] * 2;
    const rBase = extractLoudnessRms(base);
    const rLoud = extractLoudnessRms(loud);
    expect(rLoud.rms / rBase.rms).toBeCloseTo(2, 3);
  });
});

// ---------------------------------------------------------------------------
// extractSpectralCentroid
// ---------------------------------------------------------------------------

describe("extractSpectralCentroid", () => {
  // 決定論的な疑似乱数（シード固定 Mulberry32）
  // Math.random だとテストが flaky になるため
  function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateWhiteNoise(
    amplitude: number,
    durationSec: number,
    sampleRate: number,
    seed = 42
  ): Float32Array {
    const length = Math.floor(durationSec * sampleRate);
    const out = new Float32Array(length);
    const rand = makeRng(seed);
    for (let i = 0; i < length; i++) {
      out[i] = (rand() * 2 - 1) * amplitude;
    }
    return out;
  }

  function expectCloseHz(actual: number | null, expected: number, tolerancePct: number): void {
    expect(actual).not.toBeNull();
    if (actual === null) return;
    const diffPct = Math.abs(actual - expected) / expected;
    expect(diffPct).toBeLessThan(tolerancePct);
  }

  it("440Hz 正弦波のスペクトル重心は 440Hz 付近に集中する（Hann 窓の漏れ込み込みで ±8%）", () => {
    const samples = generateSine(440, 2, SAMPLE_RATE);
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expectCloseHz(result.centroidHz, 440, 0.08);
    expect(result.voicedFrameCount).toBeGreaterThan(30);
  });

  it("880Hz 正弦波のスペクトル重心は 880Hz 付近に集中する", () => {
    const samples = generateSine(880, 2, SAMPLE_RATE);
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expectCloseHz(result.centroidHz, 880, 0.08);
  });

  it("低い 220Hz より高い 880Hz の方が重心が大きい（相対比較）", () => {
    const low = extractSpectralCentroid(generateSine(220, 2, SAMPLE_RATE), SAMPLE_RATE);
    const high = extractSpectralCentroid(generateSine(880, 2, SAMPLE_RATE), SAMPLE_RATE);
    expect(low.centroidHz).not.toBeNull();
    expect(high.centroidHz).not.toBeNull();
    if (low.centroidHz !== null && high.centroidHz !== null) {
      expect(high.centroidHz).toBeGreaterThan(low.centroidHz);
    }
  });

  it("48kHz サンプルレートでも 440Hz を付近に推定する", () => {
    const sr = 48000;
    const samples = generateSine(440, 2, sr);
    const result = extractSpectralCentroid(samples, sr);
    expectCloseHz(result.centroidHz, 440, 0.08);
  });

  it("等振幅 440Hz + 880Hz 混合の重心は 2 成分の中間（440〜880Hz）に入る", () => {
    // 2 つの正弦波を等振幅で加算した信号。FFT のマグニチュード比が 1:1 なので
    // 重心は単純平均 660Hz 付近に寄る（Hann 窓の漏れ込みで揺れる）。
    const length = SAMPLE_RATE * 2;
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) + 0.5 * Math.sin(2 * Math.PI * 880 * t);
    }
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expect(result.centroidHz).not.toBeNull();
    if (result.centroidHz !== null) {
      expect(result.centroidHz).toBeGreaterThan(440);
      expect(result.centroidHz).toBeLessThan(880);
    }
  });

  it("ホワイトノイズ（広帯域）は声帯域レンジ外判定で null を返す", () => {
    // ホワイトノイズの理論重心 ≒ nyquist/2 ≒ 11kHz > MAX_CENTROID_HZ=8000 のため
    // 各フレームの重心がレンジ外として捨てられ、最終結果は null になる（設計通り）。
    const samples = generateWhiteNoise(0.3, 2, SAMPLE_RATE);
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expect(result.centroidHz).toBeNull();
    expect(result.voicedFrameCount).toBeLessThan(30);
    expect(result.totalFrames).toBeGreaterThan(30);
  });

  it("無音（全ゼロ）入力は null を返す（voicedFrameCount=0）", () => {
    const samples = new Float32Array(SAMPLE_RATE * 2);
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expect(result.centroidHz).toBeNull();
    expect(result.voicedFrameCount).toBe(0);
    expect(result.totalFrames).toBeGreaterThan(0);
  });

  it("1 フレーム未満の短すぎる入力は null を返す", () => {
    const samples = generateSine(440, 0.01, SAMPLE_RATE);
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expect(result.centroidHz).toBeNull();
    expect(result.totalFrames).toBe(0);
  });

  it("MIN_VOICED_FRAMES 未満しか有声フレームが取れない入力は null を返す", () => {
    // 0.3 秒の正弦波 → フレーム約 13 枚
    const samples = generateSine(440, 0.3, SAMPLE_RATE);
    const result = extractSpectralCentroid(samples, SAMPLE_RATE);
    expect(result.centroidHz).toBeNull();
    expect(result.voicedFrameCount).toBeLessThan(30);
  });

  it("無効な sampleRate で例外を投げる", () => {
    const samples = new Float32Array(4096);
    expect(() => extractSpectralCentroid(samples, 0)).toThrow();
    expect(() => extractSpectralCentroid(samples, -1)).toThrow();
    expect(() => extractSpectralCentroid(samples, Number.NaN)).toThrow();
  });
});
