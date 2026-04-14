/**
 * 「分身の声」マッチング：抽出済み音声特徴量を 5 軸ベクトルに正規化し、
 * `lib/presetVoices.ts` の各 voice とコサイン類似度でランキングする。
 *
 * mvp-scope.md 7.Q8（B 案）に基づく：
 *   - pitch / brightness / gender は音声特徴量から自動推定
 *   - tempo はユーザー入力（スライダー）。未指定時は中央 0.5
 *   - age は MVP では推定せず、ユーザー入力 or 中央 0.5
 *
 * 純粋関数のみを定義（DOM / Web Audio に依存しない）。
 */

import type { PresetVoice, VoiceAttributeVector } from "./presetVoices";

// -------------------------------------------------------
// 正規化レンジ（mvp-scope.md Q8 / 一般的な音声学に基づく）
// -------------------------------------------------------

// 音声 F0 の現実レンジ。80Hz（成人男性低音）〜 350Hz（成人女性高音）
const PITCH_MIN_HZ = 80;
const PITCH_MAX_HZ = 350;

// スペクトル重心の発話範囲。800Hz（暗め）〜 3500Hz（明るい）
const CENTROID_MIN_HZ = 800;
const CENTROID_MAX_HZ = 3500;

// 性別推定のしきい値：男性平均 110-130Hz / 女性平均 200-220Hz の中間 ≒ 165Hz
const GENDER_PITCH_THRESHOLD_HZ = 165;
// しきい値周辺で連続的に変化させる幅（±この値で gender が 0 ↔ 1 に推移）
const GENDER_PITCH_SOFT_RANGE_HZ = 50;

export interface RawAudioFeatures {
  /** `extractPitchHz` の戻り値。検出できなければ null */
  pitchHz: number | null;
  /** `extractSpectralCentroid` の戻り値。検出できなければ null */
  centroidHz: number | null;
}

export interface NormalizeOverrides {
  /** ユーザー入力テンポ（0.0〜1.0）。未指定時は 0.5 */
  tempo?: number;
  /** ユーザー入力年代（0.0〜1.0）。未指定時は 0.5 */
  age?: number;
  /** ユーザーが明度を上書きしたい場合（0.0〜1.0）。未指定時は centroidHz から自動推定 */
  brightness?: number;
}

/**
 * 抽出済み音声特徴量を 5 軸ベクトルに正規化する。
 *
 * @throws 特徴量がどちらも null（pitch も centroid も検出失敗）の場合
 */
export function normalizeFeatures(
  features: RawAudioFeatures,
  overrides: NormalizeOverrides = {}
): VoiceAttributeVector {
  if (features.pitchHz === null && features.centroidHz === null) {
    throw new Error("normalizeFeatures: pitch も centroid も検出できませんでした");
  }

  const pitch =
    features.pitchHz === null ? 0.5 : normalizeRange(features.pitchHz, PITCH_MIN_HZ, PITCH_MAX_HZ);
  const brightnessAuto =
    features.centroidHz === null
      ? 0.5
      : normalizeRange(features.centroidHz, CENTROID_MIN_HZ, CENTROID_MAX_HZ);
  const gender = features.pitchHz === null ? 0.5 : estimateGenderFromPitch(features.pitchHz);

  return {
    pitch,
    brightness: clamp01(overrides.brightness ?? brightnessAuto),
    tempo: clamp01(overrides.tempo ?? 0.5),
    gender,
    age: clamp01(overrides.age ?? 0.5),
  };
}

/**
 * ピッチ（Hz）→ 性別軸（0=男性的 / 1=女性的）。
 * しきい値前後で線形に補間する（ロジスティック近似）。
 */
function estimateGenderFromPitch(pitchHz: number): number {
  const delta = pitchHz - GENDER_PITCH_THRESHOLD_HZ;
  return clamp01(0.5 + delta / (2 * GENDER_PITCH_SOFT_RANGE_HZ));
}

function normalizeRange(value: number, min: number, max: number): number {
  if (max <= min) {
    throw new Error(`normalizeRange: invalid range min=${min} max=${max}`);
  }
  return clamp01((value - min) / (max - min));
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// -------------------------------------------------------
// コサイン類似度ランキング
// -------------------------------------------------------

const VECTOR_KEYS = ["pitch", "brightness", "tempo", "gender", "age"] as const;

export interface VoiceMatchResult {
  voice: PresetVoice;
  /** -1.0〜1.0 のコサイン類似度（実際は 0〜1 の範囲を取る想定） */
  score: number;
}

/**
 * 5 次元ベクトル同士のコサイン類似度。
 * ゼロベクトル（全要素 0）が混入したら 0 を返す。
 */
export function cosineSimilarity(a: VoiceAttributeVector, b: VoiceAttributeVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of VECTOR_KEYS) {
    const av = a[key];
    const bv = b[key];
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * 録音から得た 5 軸ベクトルに対し、preset voice 群を類似度降順でランキングする。
 *
 * @param target 録音側の 5 軸ベクトル
 * @param voices 候補 voice 一覧
 * @param topN 何件返すか（既定：全件）
 */
export function rankVoices(
  target: VoiceAttributeVector,
  voices: readonly PresetVoice[],
  topN?: number
): VoiceMatchResult[] {
  const scored = voices.map((voice) => ({
    voice,
    score: cosineSimilarity(target, voice.attributes),
  }));
  scored.sort((a, b) => b.score - a.score);
  return typeof topN === "number" ? scored.slice(0, topN) : scored;
}
