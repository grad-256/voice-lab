/**
 * プリセット場面データ（mvp-scope.md 7.Q1 で確定した 7 個）。
 *
 * Sprint 5 後：フレーズは Claude Sonnet 4.5 で動的生成するようになった（`/api/scene-suggest`）。
 * このファイルは「どんな場面か」「どんな感情に陥る場面か」の文脈メタデータのみを保持し、
 * Sonnet にそのまま渡すための情報源になる。
 *
 * 静的フレーズは `lib/sceneSuggest.ts` の Sonnet 障害時フォールバックに移管した。
 */

export interface PresetScene {
  /** 安定 ID（カード選択ログの `scene_id` / フォールバック引当キー） */
  id: string;
  /** 場面名（カード・詳細の見出し） */
  title: string;
  /** 日本語情景（「どんな場面か」を一文で） */
  situationJa: string;
  /** ユーザー感情（「詰まった」「緊張する」等） */
  emotionJa: string;
}

export const PRESET_SCENES: readonly PresetScene[] = [
  // -------------------- 必須 3 個 --------------------
  {
    id: "station-directions",
    title: "駅で道を聞かれる",
    situationJa: "観光客から「〇〇まではどう行けばいい？」と道案内を求められた場面。",
    emotionJa: "言いたいことはあるけど、とっさに英語が出てこない。",
  },
  {
    id: "restroom",
    title: "トイレの場所を教える",
    situationJa: "店内で「トイレはどこですか？」と聞かれ、上階を案内する場面。",
    emotionJa: "英語で場所の説明が組み立てられず、身振りで逃げがち。",
  },
  {
    id: "checkout",
    title: "会計・支払いのやりとり",
    situationJa: "レジで「カードで」「袋不要」「領収書ください」と伝えたい場面。",
    emotionJa: "定型句なのに毎回詰まってしまう。",
  },
  // -------------------- 推奨 4 個 --------------------
  {
    id: "train-transfer",
    title: "電車の乗り換え案内",
    situationJa: "路線や乗換駅を英語で説明したい場面。",
    emotionJa: "路線名・駅名の発音が不安で沈黙しがち。",
  },
  {
    id: "airport",
    title: "空港で荷物・入国",
    situationJa: "手荷物・席希望・入国審査のやりとり。",
    emotionJa: "短い質問でも、答え方が定まらない。",
  },
  {
    id: "cafe-order",
    title: "カフェ・レストラン注文",
    situationJa: "持ち帰り・アイス指定・ミルク抜きなど細かい注文を伝える場面。",
    emotionJa: "ニュアンスが分からず、結局「OK」で済ませがち。",
  },
  {
    id: "small-talk",
    title: "道で話しかけられた雑談",
    situationJa: "すれ違いざまに「どこから来たの？」と話しかけられた場面。",
    emotionJa: "短い返しが続かず、会話が途切れる。",
  },
] as const;

/** id で場面を引く。未知 id は `undefined` を返す（呼び出し側で判定）。 */
export function getSceneById(id: string): PresetScene | undefined {
  return PRESET_SCENES.find((scene) => scene.id === id);
}
