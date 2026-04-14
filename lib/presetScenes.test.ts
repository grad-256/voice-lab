import { describe, expect, it } from "vitest";
import { PRESET_SCENES, type PresetScene, getSceneById, isSceneCompleted } from "./presetScenes";

// -------------------------------------------------------
// presetScenes
// Sprint 2 の独立画面で使う 7 場面 JSON の整合性と純粋関数をテスト
// -------------------------------------------------------

describe("PRESET_SCENES", () => {
  it("必須 3 + 推奨 4 = 7 場面（mvp-scope.md 7.Q1）", () => {
    expect(PRESET_SCENES).toHaveLength(7);
  });

  it("各場面は 2〜3 個のフレーズを持つ", () => {
    for (const scene of PRESET_SCENES) {
      expect(scene.phrases.length).toBeGreaterThanOrEqual(2);
      expect(scene.phrases.length).toBeLessThanOrEqual(3);
    }
  });

  it("scene.id は全場面で一意", () => {
    const ids = PRESET_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("phraseId は全場面にまたがって一意（PostHog イベントキーとして使うため）", () => {
    const phraseIds = PRESET_SCENES.flatMap((s) => s.phrases.map((p) => p.phraseId));
    expect(new Set(phraseIds).size).toBe(phraseIds.length);
  });

  it("必須フィールドが空文字でない", () => {
    for (const scene of PRESET_SCENES) {
      expect(scene.title).not.toBe("");
      expect(scene.situationJa).not.toBe("");
      expect(scene.emotionJa).not.toBe("");
      for (const phrase of scene.phrases) {
        expect(phrase.phraseId).not.toBe("");
        expect(phrase.enText).not.toBe("");
        expect(phrase.jaIntent).not.toBe("");
      }
    }
  });
});

describe("getSceneById", () => {
  it("既知 id を解決できる", () => {
    const scene = getSceneById("checkout");
    expect(scene?.title).toBe("会計・支払いのやりとり");
  });

  it("未知 id は undefined を返す", () => {
    expect(getSceneById("nonexistent")).toBeUndefined();
  });
});

describe("isSceneCompleted", () => {
  const scene: PresetScene = PRESET_SCENES[0];

  it("全フレーズ再生済みで true", () => {
    const played = new Set(scene.phrases.map((p) => p.phraseId));
    expect(isSceneCompleted(scene, played)).toBe(true);
  });

  it("1 つでも欠けていれば false", () => {
    const played = new Set(scene.phrases.slice(0, -1).map((p) => p.phraseId));
    expect(isSceneCompleted(scene, played)).toBe(false);
  });

  it("空集合で false", () => {
    expect(isSceneCompleted(scene, new Set())).toBe(false);
  });

  it("別場面の phraseId が混じっても、この場面の全フレーズが揃っていれば true", () => {
    const played = new Set([...scene.phrases.map((p) => p.phraseId), "scene-restroom-1"]);
    expect(isSceneCompleted(scene, played)).toBe(true);
  });
});
