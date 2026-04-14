/**
 * プリセット場面データ（mvp-scope.md 7.Q1 で確定した 7 個）。
 *
 * MVP では DB に入れず静的配置する。将来 Supabase `preset_scenes` に移行可能な形で構造化。
 * `phrase_id` は `scene-{sceneId}-{index}` の固定 ID。PostHog `phrase_play` 等のキーとして使う。
 */

export interface PresetPhrase {
  /** 安定 ID（PostHog イベントキー・再生履歴突合に使用） */
  phraseId: string;
  /** 英文（ElevenLabs にそのまま渡す） */
  enText: string;
  /** 日本語の意図（字幕表示 ON 時に表示） */
  jaIntent: string;
}

export interface PresetScene {
  /** 安定 ID（カード選択ログの `scene_id`） */
  id: string;
  /** 場面名（カード・詳細の見出し） */
  title: string;
  /** 日本語情景（「どんな場面か」を一文で） */
  situationJa: string;
  /** ユーザー感情（「詰まった」「緊張する」等） */
  emotionJa: string;
  /** 英フレーズ 2〜3 個 */
  phrases: PresetPhrase[];
}

export const PRESET_SCENES: readonly PresetScene[] = [
  // -------------------- 必須 3 個 --------------------
  {
    id: "station-directions",
    title: "駅で道を聞かれる",
    situationJa: "観光客から「〇〇まではどう行けばいい？」と道案内を求められた場面。",
    emotionJa: "言いたいことはあるけど、とっさに英語が出てこない。",
    phrases: [
      {
        phraseId: "scene-station-directions-1",
        enText: "Go straight and turn left at the corner.",
        jaIntent: "まっすぐ行って、角を左に曲がってください。",
      },
      {
        phraseId: "scene-station-directions-2",
        enText: "It's about a 5-minute walk.",
        jaIntent: "歩いて 5 分くらいです。",
      },
      {
        phraseId: "scene-station-directions-3",
        enText: "You'll see it on your right.",
        jaIntent: "右手に見えてきますよ。",
      },
    ],
  },
  {
    id: "restroom",
    title: "トイレの場所を教える",
    situationJa: "店内で「トイレはどこですか？」と聞かれ、上階を案内する場面。",
    emotionJa: "英語で場所の説明が組み立てられず、身振りで逃げがち。",
    phrases: [
      {
        phraseId: "scene-restroom-1",
        enText: "The restroom is upstairs.",
        jaIntent: "お手洗いは上の階です。",
      },
      {
        phraseId: "scene-restroom-2",
        enText: "Go up these stairs, it's on the second floor.",
        jaIntent: "この階段を上がった 2 階にあります。",
      },
      {
        phraseId: "scene-restroom-3",
        enText: "It's at the back on the left.",
        jaIntent: "奥に進んで左側です。",
      },
    ],
  },
  {
    id: "checkout",
    title: "会計・支払いのやりとり",
    situationJa: "レジで「カードで」「袋不要」「領収書ください」と伝えたい場面。",
    emotionJa: "定型句なのに毎回詰まってしまう。",
    phrases: [
      {
        phraseId: "scene-checkout-1",
        enText: "Card, please.",
        jaIntent: "カードでお願いします。",
      },
      {
        phraseId: "scene-checkout-2",
        enText: "I don't need a bag.",
        jaIntent: "袋はいりません。",
      },
      {
        phraseId: "scene-checkout-3",
        enText: "Can I have a receipt?",
        jaIntent: "領収書をもらえますか？",
      },
    ],
  },
  // -------------------- 推奨 4 個 --------------------
  {
    id: "train-transfer",
    title: "電車の乗り換え案内",
    situationJa: "路線や乗換駅を英語で説明したい場面。",
    emotionJa: "路線名・駅名の発音が不安で沈黙しがち。",
    phrases: [
      {
        phraseId: "scene-train-transfer-1",
        enText: "Change at Shibuya and take the Yamanote Line.",
        jaIntent: "渋谷で山手線に乗り換えてください。",
      },
      {
        phraseId: "scene-train-transfer-2",
        enText: "It's two stops from here.",
        jaIntent: "ここから 2 駅です。",
      },
      {
        phraseId: "scene-train-transfer-3",
        enText: "The next train comes in 3 minutes.",
        jaIntent: "次の電車は 3 分後です。",
      },
    ],
  },
  {
    id: "airport",
    title: "空港で荷物・入国",
    situationJa: "手荷物・席希望・入国審査のやりとり。",
    emotionJa: "短い質問でも、答え方が定まらない。",
    phrases: [
      {
        phraseId: "scene-airport-1",
        enText: "I'd like a window seat.",
        jaIntent: "窓側の席をお願いします。",
      },
      {
        phraseId: "scene-airport-2",
        enText: "I'm here for sightseeing.",
        jaIntent: "観光で来ました。",
      },
      {
        phraseId: "scene-airport-3",
        enText: "Just this carry-on.",
        jaIntent: "この手荷物だけです。",
      },
    ],
  },
  {
    id: "cafe-order",
    title: "カフェ・レストラン注文",
    situationJa: "持ち帰り・アイス指定・ミルク抜きなど細かい注文を伝える場面。",
    emotionJa: "ニュアンスが分からず、結局「OK」で済ませがち。",
    phrases: [
      {
        phraseId: "scene-cafe-order-1",
        enText: "For here, please.",
        jaIntent: "店内でお願いします。",
      },
      {
        phraseId: "scene-cafe-order-2",
        enText: "Iced, not hot.",
        jaIntent: "ホットじゃなくてアイスで。",
      },
      {
        phraseId: "scene-cafe-order-3",
        enText: "No milk, thanks.",
        jaIntent: "ミルクは抜きで。",
      },
    ],
  },
  {
    id: "small-talk",
    title: "道で話しかけられた雑談",
    situationJa: "すれ違いざまに「どこから来たの？」と話しかけられた場面。",
    emotionJa: "短い返しが続かず、会話が途切れる。",
    phrases: [
      {
        phraseId: "scene-small-talk-1",
        enText: "Is this your first time in Japan?",
        jaIntent: "日本は初めてですか？",
      },
      {
        phraseId: "scene-small-talk-2",
        enText: "Where are you from?",
        jaIntent: "どちらから来たんですか？",
      },
      {
        phraseId: "scene-small-talk-3",
        enText: "How long are you staying?",
        jaIntent: "どれくらい滞在する予定ですか？",
      },
    ],
  },
] as const;

/** id で場面を引く。未知 id は `undefined` を返す（呼び出し側で判定）。 */
export function getSceneById(id: string): PresetScene | undefined {
  return PRESET_SCENES.find((scene) => scene.id === id);
}

/**
 * `playedPhraseIds` の集合が `scene` の全フレーズを網羅しているかを判定。
 * `scene_completed` イベント発火条件（全フレーズを 1 回以上再生）に使う。
 */
export function isSceneCompleted(
  scene: PresetScene,
  playedPhraseIds: ReadonlySet<string>
): boolean {
  return scene.phrases.every((phrase) => playedPhraseIds.has(phrase.phraseId));
}
