import { describe, expect, it } from "vitest";
import { PRESET_VOICES, type PresetVoice } from "./presetVoices";
import {
  type VoiceMatchResult,
  cosineSimilarity,
  normalizeFeatures,
  rankVoices,
} from "./voiceMatcher";

// -------------------------------------------------------
// normalizeFeatures
// -------------------------------------------------------

describe("normalizeFeatures", () => {
  it("低めの男性ピッチは pitch 軸も gender 軸も低く出る", () => {
    const v = normalizeFeatures({ pitchHz: 110, centroidHz: 1500 });
    expect(v.pitch).toBeLessThan(0.3); // (110-80)/(350-80) ≒ 0.11
    expect(v.gender).toBeLessThan(0.3); // 110 < 165 - 50 → ほぼ 0 寄り
  });

  it("高めの女性ピッチは pitch 軸も gender 軸も高く出る", () => {
    const v = normalizeFeatures({ pitchHz: 240, centroidHz: 2500 });
    expect(v.pitch).toBeGreaterThan(0.5);
    expect(v.gender).toBeGreaterThan(0.7);
  });

  it("レンジ外は [0,1] にクランプされる", () => {
    const low = normalizeFeatures({ pitchHz: 30, centroidHz: 100 });
    expect(low.pitch).toBe(0);
    expect(low.brightness).toBe(0);

    const high = normalizeFeatures({ pitchHz: 600, centroidHz: 9000 });
    expect(high.pitch).toBe(1);
    expect(high.brightness).toBe(1);
    expect(high.gender).toBe(1);
  });

  it("tempo / age は overrides を優先、未指定なら 0.5", () => {
    const def = normalizeFeatures({ pitchHz: 150, centroidHz: 1500 });
    expect(def.tempo).toBe(0.5);
    expect(def.age).toBe(0.5);

    const overridden = normalizeFeatures(
      { pitchHz: 150, centroidHz: 1500 },
      { tempo: 0.8, age: 0.2 }
    );
    expect(overridden.tempo).toBe(0.8);
    expect(overridden.age).toBe(0.2);
  });

  it("brightness の override は centroid より優先される", () => {
    const auto = normalizeFeatures({ pitchHz: 150, centroidHz: 3000 });
    const overridden = normalizeFeatures({ pitchHz: 150, centroidHz: 3000 }, { brightness: 0.1 });
    expect(overridden.brightness).toBe(0.1);
    expect(overridden.brightness).not.toBe(auto.brightness);
  });

  it("override が範囲外でもクランプされる", () => {
    const v = normalizeFeatures(
      { pitchHz: 150, centroidHz: 1500 },
      { tempo: 1.5, age: -0.3, brightness: 5 }
    );
    expect(v.tempo).toBe(1);
    expect(v.age).toBe(0);
    expect(v.brightness).toBe(1);
  });

  it("片方の特徴量が null でも例外にならず、未検出側は 0.5 にフォールバック", () => {
    const noPitch = normalizeFeatures({ pitchHz: null, centroidHz: 2000 });
    expect(noPitch.pitch).toBe(0.5);
    expect(noPitch.gender).toBe(0.5);
    expect(noPitch.brightness).toBeCloseTo((2000 - 800) / (3500 - 800), 5);

    const noCentroid = normalizeFeatures({ pitchHz: 150, centroidHz: null });
    expect(noCentroid.brightness).toBe(0.5);
    expect(noCentroid.pitch).toBeCloseTo((150 - 80) / (350 - 80), 5);
  });

  it("両方 null は例外", () => {
    expect(() => normalizeFeatures({ pitchHz: null, centroidHz: null })).toThrow(
      /検出できませんでした/
    );
  });
});

// -------------------------------------------------------
// cosineSimilarity
// -------------------------------------------------------

describe("cosineSimilarity", () => {
  const baseline = { pitch: 0.5, brightness: 0.5, tempo: 0.5, gender: 0.5, age: 0.5 };

  it("同一ベクトルは 1.0", () => {
    expect(cosineSimilarity(baseline, baseline)).toBeCloseTo(1, 10);
  });

  it("スケール違いの同方向ベクトルも 1.0", () => {
    const a = { pitch: 0.2, brightness: 0.2, tempo: 0.2, gender: 0.2, age: 0.2 };
    const b = { pitch: 0.8, brightness: 0.8, tempo: 0.8, gender: 0.8, age: 0.8 };
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });

  it("片方がゼロベクトルなら 0（NaN にしない）", () => {
    const zero = { pitch: 0, brightness: 0, tempo: 0, gender: 0, age: 0 };
    expect(cosineSimilarity(baseline, zero)).toBe(0);
    expect(cosineSimilarity(zero, zero)).toBe(0);
  });

  it("対称性：cos(a,b) === cos(b,a)", () => {
    const a = { pitch: 0.1, brightness: 0.9, tempo: 0.3, gender: 0.7, age: 0.5 };
    const b = { pitch: 0.4, brightness: 0.2, tempo: 0.8, gender: 0.1, age: 0.6 };
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

// -------------------------------------------------------
// rankVoices
// -------------------------------------------------------

describe("rankVoices", () => {
  const slotB: PresetVoice = {
    voiceId: "voice-b",
    slot: "B",
    description: "男性 30 代",
    attributes: { pitch: 0.3, brightness: 0.4, tempo: 0.5, gender: 0.1, age: 0.5 },
  };
  const slotE: PresetVoice = {
    voiceId: "voice-e",
    slot: "E",
    description: "女性 30 代",
    attributes: { pitch: 0.65, brightness: 0.6, tempo: 0.5, gender: 0.85, age: 0.5 },
  };

  it("男性ピッチ録音は枠 B を先頭に返す", () => {
    const target = normalizeFeatures({ pitchHz: 115, centroidHz: 1400 });
    const ranked = rankVoices(target, [slotB, slotE]);
    expect(ranked[0].voice.slot).toBe("B");
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("女性ピッチ録音は枠 E を先頭に返す", () => {
    const target = normalizeFeatures({ pitchHz: 230, centroidHz: 2400 });
    const ranked = rankVoices(target, [slotB, slotE]);
    expect(ranked[0].voice.slot).toBe("E");
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("スコア降順でソートされる", () => {
    const target = normalizeFeatures({ pitchHz: 200, centroidHz: 2000 });
    const ranked = rankVoices(target, [slotB, slotE]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("topN で件数を制限できる", () => {
    const target = normalizeFeatures({ pitchHz: 200, centroidHz: 2000 });
    const ranked = rankVoices(target, [slotB, slotE], 1);
    expect(ranked).toHaveLength(1);
  });

  it("PRESET_VOICES に対しても動く（型互換性チェック）", () => {
    const target = normalizeFeatures({ pitchHz: 150, centroidHz: 1800 });
    const ranked: VoiceMatchResult[] = rankVoices(target, PRESET_VOICES);
    expect(ranked.length).toBe(PRESET_VOICES.length);
    for (const r of ranked) {
      expect(typeof r.voice.voiceId).toBe("string");
      expect(r.score).toBeGreaterThanOrEqual(-1);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});
