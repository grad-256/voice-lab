import { describe, expect, it } from "vitest";
import { PRESET_VOICES, type PresetVoice } from "./presetVoices";
import {
  type VoiceMatchResult,
  centeredCosineSimilarity,
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

// -------------------------------------------------------
// centeredCosineSimilarity（Issue #25 修正の中核）
// -------------------------------------------------------

describe("centeredCosineSimilarity", () => {
  const baseline = { pitch: 0.5, brightness: 0.5, tempo: 0.5, gender: 0.5, age: 0.5 };

  it("両方が中央値ベクトル（0.5）なら 0 を返す（ゼロ方向同士）", () => {
    expect(centeredCosineSimilarity(baseline, baseline)).toBe(0);
  });

  it("同じ方向の偏差を持つベクトルは 1.0 に近い", () => {
    // 両方とも「中央より低ピッチ・低 gender」方向
    const a = { pitch: 0.2, brightness: 0.3, tempo: 0.5, gender: 0.1, age: 0.5 };
    const b = { pitch: 0.3, brightness: 0.4, tempo: 0.5, gender: 0.15, age: 0.5 };
    expect(centeredCosineSimilarity(a, b)).toBeGreaterThan(0.9);
  });

  it("逆方向のベクトル（男性 vs 女性）は負値を返す", () => {
    const masculine = { pitch: 0.2, brightness: 0.3, tempo: 0.5, gender: 0.1, age: 0.5 };
    const feminine = { pitch: 0.7, brightness: 0.7, tempo: 0.5, gender: 0.9, age: 0.5 };
    expect(centeredCosineSimilarity(masculine, feminine)).toBeLessThan(0);
  });

  it("共通ベースライン除去：raw cos より男女判別力が強い（Issue #25 の核心）", () => {
    // Issue #25 の状況再現：男性録音 vs 女性枠 voice
    const masculineRecording = {
      pitch: 0.15,
      brightness: 0.3,
      tempo: 0.5,
      gender: 0.05,
      age: 0.5,
    };
    const feminineVoice = {
      pitch: 0.65,
      brightness: 0.6,
      tempo: 0.5,
      gender: 0.85,
      age: 0.5,
    };

    const rawCos = cosineSimilarity(masculineRecording, feminineVoice);
    const centered = centeredCosineSimilarity(masculineRecording, feminineVoice);

    // raw cos：tempo=0.5 / age=0.5 が共通項として 0.25 ずつ底上げするため、
    // 性別が逆でも 0.7 程度の高い類似度になってしまう（バグの根源）
    expect(rawCos).toBeGreaterThan(0.5);
    // centered：共通項が消え、性別反転が支配的になり負値（または 0 近辺）
    expect(centered).toBeLessThan(0);
    // 改善幅は明確（centered の方が rawCos より小さい = 識別が効いている）
    expect(centered).toBeLessThan(rawCos);
  });

  it("対称性：centered(a,b) === centered(b,a)", () => {
    const a = { pitch: 0.1, brightness: 0.9, tempo: 0.3, gender: 0.7, age: 0.5 };
    const b = { pitch: 0.4, brightness: 0.2, tempo: 0.8, gender: 0.1, age: 0.6 };
    expect(centeredCosineSimilarity(a, b)).toBeCloseTo(centeredCosineSimilarity(b, a), 10);
  });

  it("片方だけが中央値（0.5）ベクトルなら 0 を返す（NaN 防御）", () => {
    const baseline = { pitch: 0.5, brightness: 0.5, tempo: 0.5, gender: 0.5, age: 0.5 };
    const offCenter = { pitch: 0.8, brightness: 0.5, tempo: 0.5, gender: 0.5, age: 0.5 };
    expect(centeredCosineSimilarity(baseline, offCenter)).toBe(0);
    expect(centeredCosineSimilarity(offCenter, baseline)).toBe(0);
  });
});

// -------------------------------------------------------
// rankVoices（Issue #25 修正後の挙動）
// -------------------------------------------------------

describe("rankVoices", () => {
  const slotA: PresetVoice = {
    voiceId: "voice-a",
    slot: "A",
    description: "男性 20 代",
    attributes: { pitch: 0.4, brightness: 0.55, tempo: 0.5, gender: 0.15, age: 0.3 },
  };
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
  const slotG: PresetVoice = {
    voiceId: "voice-g",
    slot: "G",
    description: "中性 20〜30 代",
    // 実装と同じ「pitch / brightness を中央から微シフト + gender 厳密 0.5」値
    attributes: { pitch: 0.45, brightness: 0.45, tempo: 0.5, gender: 0.5, age: 0.4 },
  };

  it("男性ピッチ録音（115Hz）は男性枠（A or B）が女性枠 E より上位", () => {
    const target = normalizeFeatures({ pitchHz: 115, centroidHz: 1400 });
    const ranked = rankVoices(target, [slotA, slotB, slotE, slotG]);
    const topSlot = ranked[0].voice.slot;
    expect(topSlot === "A" || topSlot === "B").toBe(true);
    // E は男性枠より下に来ること（Issue #25 の核心）
    const eIdx = ranked.findIndex((r) => r.voice.slot === "E");
    const aIdx = ranked.findIndex((r) => r.voice.slot === "A");
    const bIdx = ranked.findIndex((r) => r.voice.slot === "B");
    expect(eIdx).toBeGreaterThan(aIdx);
    expect(eIdx).toBeGreaterThan(bIdx);
  });

  it("女性ピッチ録音（230Hz）は枠 E を先頭に返す", () => {
    const target = normalizeFeatures({ pitchHz: 230, centroidHz: 2400 });
    const ranked = rankVoices(target, [slotA, slotB, slotE, slotG]);
    expect(ranked[0].voice.slot).toBe("E");
  });

  it("中性ピッチ録音（170Hz）では枠 G が最上位かつ実質スコアを返す", () => {
    // 170Hz → gender ≒ 0.55（ほぼ中央）、pitch ≒ 0.33。
    // 中性枠 G を狙い撃ちする想定。極性枠（A/B/E）より上位に来ないと中性ターゲットの設計意図が崩れる
    const target = normalizeFeatures({ pitchHz: 170, centroidHz: 1900 });
    const ranked = rankVoices(target, [slotA, slotB, slotE, slotG]);
    expect(ranked[0].voice.slot).toBe("G");
    // 中心化後ゼロベクトル化していないこと（score=0 固定なら設計バグ）
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("センタード版でゼロベクトル境界：片側だけ中央のとき score=0", () => {
    // 録音側を全軸中央（centered 後ゼロ）にすると、相手が何であれ 0
    const baselineTarget = {
      pitch: 0.5,
      brightness: 0.5,
      tempo: 0.5,
      gender: 0.5,
      age: 0.5,
    };
    const ranked = rankVoices(baselineTarget, [slotA, slotB, slotE, slotG]);
    for (const r of ranked) {
      expect(r.score).toBe(0);
    }
  });

  it("スコア降順でソートされる", () => {
    const target = normalizeFeatures({ pitchHz: 200, centroidHz: 2000 });
    const ranked = rankVoices(target, [slotA, slotB, slotE, slotG]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it("topN で件数を制限できる", () => {
    const target = normalizeFeatures({ pitchHz: 200, centroidHz: 2000 });
    const ranked = rankVoices(target, [slotA, slotB, slotE, slotG], 2);
    expect(ranked).toHaveLength(2);
  });

  it("PRESET_VOICES に対しても動く（型互換性 + スコア範囲）", () => {
    const target = normalizeFeatures({ pitchHz: 150, centroidHz: 1800 });
    const ranked: VoiceMatchResult[] = rankVoices(target, PRESET_VOICES);
    expect(ranked.length).toBe(PRESET_VOICES.length);
    for (const r of ranked) {
      expect(typeof r.voice.voiceId).toBe("string");
      // 中心化後は -1〜1 の範囲（負値もありうる）
      expect(r.score).toBeGreaterThanOrEqual(-1);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  // -----------------------------------------------------------------
  // 8 枠 PRESET_VOICES 全体での回帰テスト
  // 新しい voice を追加した時に既存ターゲットを奪わないことを保証する
  // -----------------------------------------------------------------

  it("8 枠全てでも中性 170Hz 録音は G を最上位に返す（H が奪わない）", () => {
    // G の attributes コメントが「中性ターゲット 170Hz / centroid 1900Hz」を狙うと明記しているため、
    // 後発の voice 追加でこの指名打ちが崩れたら回帰として検知する
    const target = normalizeFeatures({ pitchHz: 170, centroidHz: 1900 });
    const ranked = rankVoices(target, PRESET_VOICES);
    expect(ranked[0].voice.slot).toBe("G");
  });

  it("8 枠全てでも男性 115Hz 録音は男性枠（A or B or C）を最上位に返す", () => {
    const target = normalizeFeatures({ pitchHz: 115, centroidHz: 1400 });
    const ranked = rankVoices(target, PRESET_VOICES);
    const masculineSlots = new Set(["A", "B", "C"]);
    expect(masculineSlots.has(ranked[0].voice.slot)).toBe(true);
  });

  it("8 枠全てでも女性 230Hz 録音は女性枠（D or E or F）を最上位に返す", () => {
    const target = normalizeFeatures({ pitchHz: 230, centroidHz: 2400 });
    const ranked = rankVoices(target, PRESET_VOICES);
    const feminineSlots = new Set(["D", "E", "F"]);
    expect(feminineSlots.has(ranked[0].voice.slot)).toBe(true);
  });
});
