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
