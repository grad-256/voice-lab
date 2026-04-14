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

// 中心化の基準値。0.5（各軸のレンジ中央）を引いてから cos 類似度を計算することで、
// tempo / age など全 voice 共通の中央値ベースラインを除去し、識別力を高める（Issue #25）。
const VECTOR_CENTER = 0.5;

export interface VoiceMatchResult {
  voice: PresetVoice;
  /** -1.0〜1.0 のコサイン類似度。中心化後の方向余弦のため負値も取りうる */
  score: number;
}

/**
 * 5 次元ベクトル同士のコサイン類似度（生・中心化なし）。
 * ゼロベクトル（全要素 0）が混入したら 0 を返す。
 *
 * 注意：本関数は数学的性質の検証や比較目的で残してある。ランキングには
 * `centeredCosineSimilarity` を使う。直接ランキングに使うと tempo=0.5 / age=0.5 等の
 * 共通ベースラインが類似度を底上げし、識別力が落ちる（Issue #25）。
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
 * 中心化コサイン類似度（Issue #25 修正案 A）。
 *
 * 各軸から `VECTOR_CENTER`（0.5）を引いてから cos 類似度を計算する。
 * これにより：
 *   - tempo=0.5 / age=0.5 のような voice 共通ベースラインが「ゼロ方向」となり、内積に寄与しない
 *   - pitch / gender / brightness の極性（中央より上か下か）が支配的になる
 *
 * 結果：男性録音（gender < 0.5）が女性枠（gender > 0.5）と「逆方向」を向き、
 * cos 類似度が負（または非常に低い値）になるため、男性枠が確実に上位に来る。
 *
 * 戻り値は -1.0〜1.0。中心化後にどちらかがゼロベクトル（全軸が中央 0.5）の場合は 0 を返す。
 */
export function centeredCosineSimilarity(a: VoiceAttributeVector, b: VoiceAttributeVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of VECTOR_KEYS) {
    const av = a[key] - VECTOR_CENTER;
    const bv = b[key] - VECTOR_CENTER;
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
 * 内部的には `centeredCosineSimilarity` を使用（Issue #25 修正）。
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
    score: centeredCosineSimilarity(target, voice.attributes),
  }));
  scored.sort((a, b) => b.score - a.score);
  return typeof topN === "number" ? scored.slice(0, topN) : scored;
}
