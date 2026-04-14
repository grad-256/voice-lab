/**
 * 「分身の声」マッチング用のプリセット voice 定義（mvp-scope.md 7.Q11）。
 *
 * 5 軸属性ベクトル（すべて 0.0〜1.0 に正規化）：
 *   - pitch:      低い 0.0 ↔ 1.0 高い
 *   - brightness: 暗い 0.0 ↔ 1.0 明るい（スペクトル重心ベース）
 *   - tempo:      ゆっくり 0.0 ↔ 1.0 速い
 *   - gender:     男性的 0.0 ↔ 1.0 女性的
 *   - age:        若い 0.0 ↔ 1.0 年上
 *
 * MVP 段階では 8 枠のうち 2 枠（B / E）のみ登録。残り枠は試聴選定後に追加する。
 * 値は試聴前の暫定推定値であり、選定確定後に微調整する前提。
 */
export type PresetVoiceSlot = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export interface VoiceAttributeVector {
  pitch: number;
  brightness: number;
  tempo: number;
  gender: number;
  age: number;
}

export interface PresetVoice {
  /** ElevenLabs Voice Library の voice_id */
  voiceId: string;
  /** 8 枠のうちどれに当たるか（mvp-scope.md 7.Q11 表参照） */
  slot: PresetVoiceSlot;
  /** UI 表示用の短い説明（ペルソナ） */
  description: string;
  /** コサイン類似度マッチング用の 5 軸ベクトル */
  attributes: VoiceAttributeVector;
}

/**
 * 暫定登録：枠 B（男性 30 代・落ち着き／中低域）と
 *           枠 E（女性 30 代・中音域／落ち着き）。
 *
 * attributes は試聴サンプルでの最終調整前の概算値。
 */
export const PRESET_VOICES: readonly PresetVoice[] = [
  {
    voiceId: "dn9HtxgDwCH96MVX9iAO",
    slot: "B",
    description: "男性・30代・落ち着いた中低域",
    attributes: {
      pitch: 0.3,
      brightness: 0.4,
      tempo: 0.5,
      gender: 0.1,
      age: 0.5,
    },
  },
  {
    voiceId: "uJCs8Cm3vdGWEkXI6wUX",
    slot: "E",
    description: "女性・30代・落ち着いた中音域",
    attributes: {
      pitch: 0.65,
      brightness: 0.6,
      tempo: 0.5,
      gender: 0.85,
      age: 0.5,
    },
  },
] as const;
