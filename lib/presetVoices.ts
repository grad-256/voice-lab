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
 * 暫定登録：枠 A（男性 20 代）/ B（男性 30 代）/ C（男性 40〜50 代）/
 *           D（女性 20 代前半）/ E（女性 30 代）/ G（中性 20〜30 代）/
 *           H（中性 30〜40 代）。
 *
 * attributes は試聴サンプルでの最終調整前の概算値（試聴後に微調整前提）。
 * 残りは枠 F（女性 40〜50 代）のみ未登録。
 */
export const PRESET_VOICES: readonly PresetVoice[] = [
  {
    voiceId: "klfRFkxouVP3bt55Whp3",
    slot: "A",
    description: "男性・20代前半・明るく軽やかな声",
    attributes: {
      pitch: 0.4,
      brightness: 0.55,
      tempo: 0.5,
      gender: 0.15,
      age: 0.3,
    },
  },
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
    voiceId: "a9paacvZxTlkONiCPzfC",
    slot: "C",
    description: "男性・40〜50代・落ち着いた低音域",
    attributes: {
      pitch: 0.2,
      brightness: 0.35,
      tempo: 0.45,
      gender: 0.1,
      age: 0.75,
    },
  },
  {
    voiceId: "XEQBC9sleaE3f5ff82UR",
    slot: "D",
    description: "女性・20代前半・明るく柔らかい声",
    attributes: {
      pitch: 0.7,
      brightness: 0.65,
      tempo: 0.55,
      gender: 0.85,
      age: 0.3,
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
  {
    voiceId: "M563YhMmA0S8vEYwkgYa",
    slot: "G",
    description: "中性的・20〜30代・フラットで中音域の声",
    // 中性枠でも全軸を 0.5 に揃えると、centeredCosineSimilarity（mvp-scope.md Q8 / Issue #25）
    // で「中心化後ゼロベクトル」となり、どんな録音とのスコアも 0 に固定されてしまう。
    // 中性ターゲット（170Hz 付近・centroid 1900Hz 付近）を実際に当てに行くため、
    // gender だけ厳密に中央 0.5 を保ちつつ pitch / brightness をその方向にわずかにずらす。
    attributes: {
      pitch: 0.45,
      brightness: 0.45,
      tempo: 0.5,
      gender: 0.5,
      age: 0.4,
    },
  },
  {
    voiceId: "Z9VxF84ucVtzvKlmYFhh",
    slot: "H",
    description: "中性的・30〜40代・クールで知的な声",
    // G 枠と差別化するため age を中央より上、brightness を少し暗めに振る。
    // gender は厳密 0.5 維持（中性枠の主性質）、pitch は中央よりわずかに低めで「落ち着き」を表現。
    attributes: {
      pitch: 0.45,
      brightness: 0.4,
      tempo: 0.5,
      gender: 0.5,
      age: 0.55,
    },
  },
] as const;
