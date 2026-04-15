import { describe, expect, it } from "vitest";
import { PRESET_SCENES, getSceneById } from "./presetScenes";

// -------------------------------------------------------
// presetScenes
// Sprint 5 後：フレーズは Sonnet 動的生成化されたため、ここでは
// 場面メタデータ（id / title / situationJa / emotionJa）の整合性のみを確認する。
// フレーズ・完了判定は `lib/sceneSuggest.test.ts` 側で検証する。
// -------------------------------------------------------

describe("PRESET_SCENES", () => {
  it("必須 3 + 推奨 4 = 7 場面（mvp-scope.md 7.Q1）", () => {
    expect(PRESET_SCENES).toHaveLength(7);
  });

  it("scene.id は全場面で一意", () => {
    const ids = PRESET_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("必須フィールドが空文字でない", () => {
    for (const scene of PRESET_SCENES) {
      expect(scene.id).not.toBe("");
      expect(scene.title).not.toBe("");
      expect(scene.situationJa).not.toBe("");
      expect(scene.emotionJa).not.toBe("");
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
