/**
 * `/api/scene-suggest` の純粋ロジック（Sprint 5 後・Sonnet 動的生成化）。
 *
 * `/echo` のプリセット場面で表示する 3 フレーズを Claude Sonnet 4.5 で動的生成する。
 * 従来の `lib/presetScenes.ts` の静的フレーズ配列を廃止し、場面の情景・感情を
 * 文脈として渡して、文脈適合度の高いフレーズを得る。
 *
 * Edge Runtime 本体（route.ts）から分離して単体テストしやすくする。
 * `/api/chat` には絶対に混入させない（mvp-scope.md 3.9 / 決定事項 14）。
 */

import { normalizeEnglish } from "./normalizeEnglish";

export const SCENE_SUGGEST_MODEL = "claude-sonnet-4-5";
export const SCENE_SUGGEST_CACHE_TTL_MS = 30 * 60 * 1000; // 30 分

export interface SceneSuggestedPhrase {
  /** 安定 ID（PostHog 突合キー）。API 側で crypto.randomUUID で発行 */
  phrase_id: string;
  /** 日本語で「この英訳は何を言う意図か」を短く示す */
  ja_intent: string;
  /** 英訳本文（ElevenLabs にそのまま渡せる表記） */
  en_text: string;
  /** 突合用に正規化した英訳（normalizeEnglish で生成） */
  en_text_normalized: string;
}

export interface SceneSuggestRequest {
  scene_id: string;
  situation_ja: string;
  emotion_ja: string;
  /** ユーザーが入力した具体状況（任意、将来拡張用） */
  user_context?: string;
}

export interface SceneSuggestResponse {
  phrases: SceneSuggestedPhrase[];
  /** ルールベースフォールバックで返した場合のみ true */
  fallback?: boolean;
}

// ────────────────────────────────────────────────
// Sonnet 用プロンプト
// ────────────────────────────────────────────────

export function buildSceneSuggestSystemPrompt(): string {
  return `You help a Japanese English learner prepare useful phrases for a specific real-world scene.
Given the scene description (situation and the learner's emotional struggle), suggest exactly 3
natural English phrases the learner is likely to want to say in that scene.

STRICT OUTPUT FORMAT — respond with ONLY a JSON object, no prose, no code fences:
{"phrases":[{"ja_intent":"<短い日本語の意図>","en_text":"<English phrase>"}]}

Rules:
- Return exactly 3 phrases that cover a range of likely utterances in this scene.
- Each en_text MUST be one short spoken sentence (under 15 words), at an everyday conversational register.
- Avoid textbook-stiff phrasing. Prefer what a real native speaker would say in this moment.
- Choose phrases that genuinely fit the described situation and emotion — not generic greetings.
- ja_intent is a concise Japanese label (under 20 chars) describing what the phrase is trying to do.
- Do NOT include romaji, explanations, or any text outside the JSON.`;
}

export function buildSceneSuggestUserContent(input: {
  sceneId: string;
  situationJa: string;
  emotionJa: string;
  userContext?: string | null;
}): string {
  const { sceneId, situationJa, emotionJa, userContext } = input;
  const parts: string[] = [
    `Scene id: ${sceneId}`,
    `Situation (Japanese):\n${situationJa}`,
    `Learner's emotion / struggle (Japanese):\n${emotionJa}`,
  ];
  if (userContext && userContext.trim().length > 0) {
    parts.push(`Specific context the learner added (Japanese):\n${userContext.trim()}`);
  }
  parts.push(
    "Produce 3 phrases tuned to THIS specific situation and emotion. Do not fall back to generic phrases."
  );
  return parts.join("\n\n");
}

/**
 * Claude 応答から `phrases[]` を取り出す。コードフェンス付き / 文中混在にも耐える。
 * 整形失敗時は空配列を返し、呼び出し側でフォールバックへ。
 *
 * `lib/suggest.ts` の同名関数と似ているが、こちらは厳密に 3 件を切り出す。
 */
export function parseSceneSuggestResponse(
  raw: string
): Array<{ ja_intent: string; en_text: string }> {
  if (typeof raw !== "string" || raw.length === 0) return [];

  const tryParse = (s: string) => {
    try {
      const parsed = JSON.parse(s) as {
        phrases?: Array<{ ja_intent?: unknown; en_text?: unknown }>;
      };
      if (!Array.isArray(parsed.phrases)) return null;
      return parsed.phrases
        .map((p) => ({
          ja_intent: typeof p.ja_intent === "string" ? p.ja_intent : "",
          en_text: typeof p.en_text === "string" ? p.en_text : "",
        }))
        .filter((p) => p.en_text.length > 0)
        .slice(0, 3);
    } catch {
      return null;
    }
  };

  const direct = tryParse(raw.trim());
  if (direct && direct.length > 0) return direct;

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inside = tryParse(fence[1].trim());
    if (inside && inside.length > 0) return inside;
  }

  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    const inside = tryParse(brace[0]);
    if (inside && inside.length > 0) return inside;
  }

  return [];
}

// ────────────────────────────────────────────────
// シーン別フォールバック（Sonnet 失敗時）
// 旧 PRESET_SCENES の静的フレーズを「最低限の動作保証」として保持する。
// あくまで非常用なので、動的生成が成功した場合はこちらは使わない。
// ────────────────────────────────────────────────

interface FallbackEntry {
  ja_intent: string;
  en_text: string;
}

const FALLBACK_BY_SCENE: Record<string, FallbackEntry[]> = {
  "station-directions": [
    {
      ja_intent: "まっすぐ行って、角を左に曲がる",
      en_text: "Go straight and turn left at the corner.",
    },
    { ja_intent: "徒歩 5 分ほどの距離", en_text: "It's about a 5-minute walk." },
    { ja_intent: "右手に見えてくる", en_text: "You'll see it on your right." },
  ],
  restroom: [
    { ja_intent: "お手洗いは上の階", en_text: "The restroom is upstairs." },
    {
      ja_intent: "この階段を上がった 2 階",
      en_text: "Go up these stairs, it's on the second floor.",
    },
    { ja_intent: "奥に進んで左側", en_text: "It's at the back on the left." },
  ],
  checkout: [
    { ja_intent: "カードで支払う", en_text: "Card, please." },
    { ja_intent: "袋は不要", en_text: "I don't need a bag." },
    { ja_intent: "領収書が欲しい", en_text: "Can I have a receipt?" },
  ],
  "train-transfer": [
    {
      ja_intent: "渋谷で山手線に乗り換え",
      en_text: "Change at Shibuya and take the Yamanote Line.",
    },
    { ja_intent: "ここから 2 駅", en_text: "It's two stops from here." },
    { ja_intent: "次の電車は 3 分後", en_text: "The next train comes in 3 minutes." },
  ],
  airport: [
    { ja_intent: "窓側の席をお願い", en_text: "I'd like a window seat." },
    { ja_intent: "観光で来た", en_text: "I'm here for sightseeing." },
    { ja_intent: "手荷物はこれだけ", en_text: "Just this carry-on." },
  ],
  "cafe-order": [
    { ja_intent: "店内で", en_text: "For here, please." },
    { ja_intent: "アイスで", en_text: "Iced, not hot." },
    { ja_intent: "ミルク抜き", en_text: "No milk, thanks." },
  ],
  "small-talk": [
    { ja_intent: "日本は初めてか尋ねる", en_text: "Is this your first time in Japan?" },
    { ja_intent: "出身を尋ねる", en_text: "Where are you from?" },
    { ja_intent: "滞在期間を尋ねる", en_text: "How long are you staying?" },
  ],
};

const GENERIC_FALLBACK: FallbackEntry[] = [
  { ja_intent: "伝えたいことを丁寧に言い直す", en_text: "Let me try to say that again." },
  { ja_intent: "少し時間がほしいと伝える", en_text: "Give me a moment to think." },
  { ja_intent: "もう一度お願いする", en_text: "Could you say that again, please?" },
];

export function buildFallbackPhrases(sceneId: string): FallbackEntry[] {
  const match = FALLBACK_BY_SCENE[sceneId];
  if (match) return match.map((p) => ({ ...p }));
  return GENERIC_FALLBACK.map((p) => ({ ...p }));
}

// ────────────────────────────────────────────────
// 最終成形：phrase_id 付与 + 正規化テキスト付与
// ────────────────────────────────────────────────

export function toSceneSuggestedPhrases(
  raw: Array<{ ja_intent: string; en_text: string }>,
  generateId: () => string
): SceneSuggestedPhrase[] {
  return raw.slice(0, 3).map((p) => ({
    phrase_id: generateId(),
    ja_intent: p.ja_intent,
    en_text: p.en_text,
    en_text_normalized: normalizeEnglish(p.en_text),
  }));
}

// ────────────────────────────────────────────────
// クライアント側キャッシュ（sessionStorage）
// ────────────────────────────────────────────────

export interface SceneSuggestCacheEntry {
  phrases: SceneSuggestedPhrase[];
  fallback: boolean;
  fetched_at: number;
}

export function cacheKeyFor(sceneId: string): string {
  return `scene-suggest:${sceneId}`;
}

export function isCacheEntryFresh(
  entry: SceneSuggestCacheEntry | null,
  now: number = Date.now()
): boolean {
  if (!entry) return false;
  if (typeof entry.fetched_at !== "number") return false;
  return now - entry.fetched_at <= SCENE_SUGGEST_CACHE_TTL_MS;
}

// ────────────────────────────────────────────────
// 再生完了判定（動的フレーズ版）
// ────────────────────────────────────────────────

/**
 * 取得済み phrases に対して、全件再生済みかを判定する。
 * 旧 `isSceneCompleted(scene, played)` から「フレーズ列」ベースに置き換わった版。
 */
export function isSceneCompletedFromPhrases(
  phrases: ReadonlyArray<{ phrase_id: string }>,
  playedPhraseIds: ReadonlySet<string>
): boolean {
  if (phrases.length === 0) return false;
  return phrases.every((p) => playedPhraseIds.has(p.phrase_id));
}
