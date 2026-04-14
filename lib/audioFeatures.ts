/**
 * 音声特徴量抽出（ブラウザ側で実行する前提）
 *
 * mvp-scope.md 7.Q8 の B 案：pitchfinder@^2.3 で F0（基本周波数）を推定し、
 * スライディングウィンドウ + 中央値 + MAD 外れ値除去で安定化する。
 *
 * Web Audio API への依存はなく、純粋な Float32Array 演算のため
 * Node.js（Vitest）でも動作する。
 */

import { YIN } from "pitchfinder";

// 1 フレーム 2048 サンプル（44.1kHz で約 46ms）、50% オーバーラップ
const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;

// MAD の何倍を外れ値とみなすか（一般的に 3）
const MAD_THRESHOLD_FACTOR = 3;

// ここ未満の有声フレーム数なら「検出不可」として null を返す。
// 44.1kHz・HOP_SIZE=1024 では約 43fps なので、30 フレーム ≒ 0.7 秒相当の有声入力を要求する。
// Sprint 1 の最低録音 8 秒（mvp-scope.md 6 章）の中で、発話以外（無音・呼吸）を差し引いても
// 健全な録音ならこの閾値を余裕で超える。
const MIN_VOICED_FRAMES = 30;

// 人間の F0（基本周波数）として現実的なレンジ。
// - 下限 60Hz：成人男性の最低音（E2 ≒ 82Hz）より余裕を持たせる
// - 上限 1100Hz：成人ソプラノの F0 上限（C6 ≒ 1047Hz）をカバー。
//   1500Hz まで開けるとオクターブエラー（実 F0 750Hz → 1500Hz 誤検出）を通してしまうため狭める。
const MIN_VALID_HZ = 60;
const MAX_VALID_HZ = 1100;

export interface PitchExtractionResult {
  /** 推定された基本周波数（Hz）。検出できなければ null */
  pitchHz: number | null;
  /** 最終的に中央値計算に採用されたフレーム数（MAD 外れ値除去後のインライア数） */
  voicedFrameCount: number;
  /** 全スライディングフレーム数（声域レンジ外や無声も含む） */
  totalFrames: number;
}

/**
 * 録音波形から基本周波数（F0）を推定する。
 *
 * @param samples モノラル波形（`AudioBuffer.getChannelData(0)` で取得）
 * @param sampleRate サンプルレート（通常 44100 または 48000）
 */
export function extractPitchHz(samples: Float32Array, sampleRate: number): PitchExtractionResult {
  if (sampleRate <= 0 || !Number.isFinite(sampleRate)) {
    throw new Error(`extractPitchHz: invalid sampleRate=${sampleRate}`);
  }

  const detect = YIN({ sampleRate });
  const pitches: number[] = [];
  let totalFrames = 0;

  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    totalFrames++;
    const frame = samples.subarray(start, start + FRAME_SIZE);
    const hz = detect(frame);
    // pitchfinder は null を返すことがあり、環境によっては NaN / Infinity もあり得る。
    // 無音区間では YIN が非現実的な周波数（例：17kHz）を返すため声域レンジで絞る
    if (hz !== null && Number.isFinite(hz) && hz >= MIN_VALID_HZ && hz <= MAX_VALID_HZ) {
      pitches.push(hz);
    }
  }

  if (pitches.length < MIN_VOICED_FRAMES) {
    return { pitchHz: null, voicedFrameCount: pitches.length, totalFrames };
  }

  // 外れ値除去：YIN は稀にオクターブエラー（2 倍 or 0.5 倍）を返すため、
  // 中央値 ± 3×MAD の範囲外を捨てる
  const median = calcMedian(pitches);
  const mad = calcMedian(pitches.map((p) => Math.abs(p - median)));
  const threshold = mad * MAD_THRESHOLD_FACTOR;

  const filtered =
    threshold > 0 ? pitches.filter((p) => Math.abs(p - median) <= threshold) : pitches;

  // フィルタ後に全滅した場合は元の中央値を返す
  const finalPitches = filtered.length > 0 ? filtered : pitches;

  return {
    pitchHz: calcMedian(finalPitches),
    voicedFrameCount: finalPitches.length,
    totalFrames,
  };
}

function calcMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ===========================================================================
// ラウドネス（RMS）
// ===========================================================================

export interface LoudnessExtractionResult {
  /** 信号全体のリニア RMS（Float32 サンプル値の二乗平均平方根） */
  rms: number;
  /** `20 * log10(rms)` を -120dB でクランプした値。dBFS 相当 */
  rmsDb: number;
  /** 計算に使用したサンプル数 */
  sampleCount: number;
}

// 無音（rms=0）を log に入れると -Infinity になるため、下限で打ち止める
const MIN_RMS_DB = -120;

/**
 * 録音波形全体のラウドネス（RMS）を計算する。
 *
 * - 本関数はフレーム分割しない「全体平均」を返す最小実装（mvp-scope.md Q8 B 案）。
 *   フレーム毎の短時間ラウドネスが必要になった場合は別関数として追加する。
 * - 空入力では RMS=0 / dB=MIN_RMS_DB を返す（例外は投げない）。
 *
 * @param samples モノラル波形（`AudioBuffer.getChannelData(0)` で取得）
 */
export function extractLoudnessRms(samples: Float32Array): LoudnessExtractionResult {
  if (samples.length === 0) {
    return { rms: 0, rmsDb: MIN_RMS_DB, sampleCount: 0 };
  }

  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  const rmsDb = rms > 0 ? Math.max(MIN_RMS_DB, 20 * Math.log10(rms)) : MIN_RMS_DB;

  return { rms, rmsDb, sampleCount: samples.length };
}

// ===========================================================================
// スペクトル重心（トーンの明度）
// ===========================================================================

// 声のスペクトル重心として意味のあるレンジ。
// - 下限 80Hz：男性の基音程度（これ未満はハム / DC バイアス）
// - 上限 8000Hz：通常の発話で有意なエネルギーがある上限（子音の摩擦音含む）
const MIN_CENTROID_HZ = 80;
const MAX_CENTROID_HZ = 8000;

// 有声フレームと判定するためのフレーム RMS 閾値。
// ホワイトノイズや無音フレームがスペクトル重心を歪めないよう下限を設ける。
// -50dBFS は一般的な会話録音のノイズフロア（-60dB 付近）より十分高い。
const FRAME_RMS_FLOOR = 10 ** (-50 / 20);

export interface SpectralCentroidResult {
  /** 推定されたスペクトル重心（Hz）。有声フレームが足りない場合は null */
  centroidHz: number | null;
  /** 中央値計算に採用されたフレーム数（RMS フロア通過 + 外れ値除去後のインライア数） */
  voicedFrameCount: number;
  /** 全スライディングフレーム数 */
  totalFrames: number;
}

/**
 * 録音波形のスペクトル重心（トーンの明るさの指標）を推定する。
 *
 * - Hann 窓 + 自前 radix-2 FFT（FRAME_SIZE=2048）でフレーム毎に重心を計算
 * - フレーム RMS が `FRAME_RMS_FLOOR` 未満のフレームは無声として除外
 * - `MIN_CENTROID_HZ` 〜 `MAX_CENTROID_HZ` の声帯域外を捨て、
 *   最後に中央値 ± 3×MAD で外れ値除去し中央値を返す（F0 と同じロジック）
 *
 * 本関数は純粋関数であり、Web Audio API の `AnalyserNode` には依存しない
 * （Vitest でも動作する）。
 *
 * @param samples モノラル波形
 * @param sampleRate サンプルレート
 */
export function extractSpectralCentroid(
  samples: Float32Array,
  sampleRate: number
): SpectralCentroidResult {
  if (sampleRate <= 0 || !Number.isFinite(sampleRate)) {
    throw new Error(`extractSpectralCentroid: invalid sampleRate=${sampleRate}`);
  }

  const window = buildHannWindow(FRAME_SIZE);
  const centroids: number[] = [];
  let totalFrames = 0;

  // FFT 用バッファを使い回し（アロケーションを抑える）
  const re = new Float32Array(FRAME_SIZE);
  const im = new Float32Array(FRAME_SIZE);

  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    totalFrames++;
    const frame = samples.subarray(start, start + FRAME_SIZE);

    // フレーム RMS でゲート（無音・ごく小さいノイズは捨てる）
    let frameSumSq = 0;
    for (let i = 0; i < FRAME_SIZE; i++) {
      frameSumSq += frame[i] * frame[i];
    }
    const frameRms = Math.sqrt(frameSumSq / FRAME_SIZE);
    if (frameRms < FRAME_RMS_FLOOR) continue;

    // Hann 窓を掛けて実部バッファへ
    for (let i = 0; i < FRAME_SIZE; i++) {
      re[i] = frame[i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);

    // 片側スペクトルの重心を計算
    const centroidHz = computeCentroidHz(re, im, sampleRate);
    if (
      centroidHz !== null &&
      Number.isFinite(centroidHz) &&
      centroidHz >= MIN_CENTROID_HZ &&
      centroidHz <= MAX_CENTROID_HZ
    ) {
      centroids.push(centroidHz);
    }
  }

  if (centroids.length < MIN_VOICED_FRAMES) {
    return { centroidHz: null, voicedFrameCount: centroids.length, totalFrames };
  }

  const median = calcMedian(centroids);
  const mad = calcMedian(centroids.map((c) => Math.abs(c - median)));
  const threshold = mad * MAD_THRESHOLD_FACTOR;
  const filtered =
    threshold > 0 ? centroids.filter((c) => Math.abs(c - median) <= threshold) : centroids;
  const finalCentroids = filtered.length > 0 ? filtered : centroids;

  return {
    centroidHz: calcMedian(finalCentroids),
    voicedFrameCount: finalCentroids.length,
    totalFrames,
  };
}

// ===========================================================================
// 内部ユーティリティ：Hann 窓 / radix-2 FFT / 重心計算
// ===========================================================================

// Hann 窓はフレーム毎に同じ係数を使うため、モジュールレベルでキャッシュ
const hannWindowCache = new Map<number, Float32Array>();

function buildHannWindow(size: number): Float32Array {
  const cached = hannWindowCache.get(size);
  if (cached) return cached;
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  hannWindowCache.set(size, w);
  return w;
}

/**
 * 2 の冪サイズ限定の in-place radix-2 Cooley-Tukey FFT。
 * `FRAME_SIZE = 2048 = 2^11` のみで使用するため任意サイズ対応は不要。
 */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const N = re.length;
  if ((N & (N - 1)) !== 0) {
    throw new Error(`fftInPlace: size must be power of 2, got ${N}`);
  }

  // ビット反転並べ替え
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; (j & bit) !== 0; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // バタフライ演算
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + halfLen];
        const bIm = im[i + k + halfLen];
        const tRe = wRe * bRe - wIm * bIm;
        const tIm = wRe * bIm + wIm * bRe;
        re[i + k] = aRe + tRe;
        im[i + k] = aIm + tIm;
        re[i + k + halfLen] = aRe - tRe;
        im[i + k + halfLen] = aIm - tIm;
        const newWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = newWRe;
      }
    }
  }
}

/**
 * FFT 結果から片側マグニチュードスペクトルの重心（Hz）を計算する。
 * DC 成分（k=0）は除外する。
 */
function computeCentroidHz(re: Float32Array, im: Float32Array, sampleRate: number): number | null {
  const N = re.length;
  const halfN = N >> 1;
  let weightedSum = 0;
  let magSum = 0;
  // DC（k=0）とナイキスト（k=N/2）は除外
  for (let k = 1; k < halfN; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    const freq = (k * sampleRate) / N;
    weightedSum += freq * mag;
    magSum += mag;
  }
  if (magSum === 0) return null;
  return weightedSum / magSum;
}
